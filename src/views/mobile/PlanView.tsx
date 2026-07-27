import { useEffect, useMemo, useState } from 'react'
import { KIND_LABELS } from '../../widgets/EventRow'
import { isLocalEvent } from '../../lib/eventFilters'
import {
  addGetReadyReminder,
  ensureNotificationPermission,
  listGetReadyReminders,
  listPendingReminderFeedback,
  recordReminderFeedback,
  type GetReadyReminder,
  type ReminderFeedbackOutcome,
} from '../../lib/getReadyReminders'
import { CAMERA_PROFILES, getDefaultDevice } from '../../lib/cameraProfiles'
import { recipeKeyForEventKind } from '../../lib/cameraRecipes'
import { getEventsInRange, pullSkyEvents } from '../../lib/sync'
import { addToWatchlist, getWatchlist, isWatching, matchesWatchlist, removeFromWatchlist, type WatchlistItem } from '../../lib/watchlist'
import { fetchViewingForecast, localDateKey, type DailyViewingAdvisory } from '../../lib/weather'
import { scoreTonight, type TonightRating } from '../../lib/tonightScore'
import { trackEvent } from '../../lib/analytics'
import { moonIlluminationPctAt } from '../../lib/moonPhase'
import { formatEventDate, daysUntil } from '../../lib/eventFormat'
import { DarkSitesPanel, darkSitesSummary } from '../../components/mobile/DarkSitesPanel'
import { GearFitPanel, defaultGearFitSummary } from '../../components/mobile/GearFitPanel'
import { EventDetailPanel } from '../../components/mobile/EventDetailPanel'
import { useEventPointing } from '../../components/mobile/EventPointing'
import { SkyEventBrowser } from '../../components/mobile/SkyEventBrowser'
import { MobileIcon } from '../../components/mobile/MobileIcon'
import { PaywallGate } from '../../components/PaywallGate'
import { useAuth } from '../../lib/auth'
import { eventLookaheadDays, forecastLookaheadDays } from '../../lib/entitlementLimits'
import { buildDailySkyGuideEvents, SKY_GUIDE_WINDOW_DAYS } from '../../lib/visiblePlanets'
import type { CurrentLocation } from '../../lib/currentLocation'
import type { SkyEvent } from '../../lib/db'
import type { ObservationDraft } from '../../lib/observationDraft'
import { WatchView } from './WatchView'

type PlanMode = 'ready' | 'watchlist' | 'calendar' | 'browse'
type ToolPanel = 'dark-sites' | 'gear-fit' | null

function ratingToStatus(rating: TonightRating): 'go' | 'marginal' | 'poor' {
  if (rating === 'great' || rating === 'good') return 'go'
  if (rating === 'maybe') return 'marginal'
  return 'poor'
}

export function PlanView({
  city,
  onOpenEvents,
  onLogAttempt,
  onSavedForLater,
}: {
  city: CurrentLocation
  onOpenEvents: () => void
  onLogAttempt: (draft: ObservationDraft) => void
  onSavedForLater?: () => void
}) {
  const [mode, setMode] = useState<PlanMode>('browse')
  const [events, setEvents] = useState<SkyEvent[] | null>(null)
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [reminders, setReminders] = useState<GetReadyReminder[]>(() => listGetReadyReminders())
  const [pendingFeedback, setPendingFeedback] = useState<GetReadyReminder[]>(() => listPendingReminderFeedback())
  const [selected, setSelected] = useState<SkyEvent | null>(null)
  const [status, setStatus] = useState('')
  const [advisory, setAdvisory] = useState<DailyViewingAdvisory[]>([])
  const [advisoryTimeZone, setAdvisoryTimeZone] = useState<string | undefined>(city.timeZone)
  const [toolPanel, setToolPanel] = useState<ToolPanel>(null)
  const [blockedPlanAdd, setBlockedPlanAdd] = useState(false)
  const [feedbackNotes, setFeedbackNotes] = useState<Record<string, string>>({})
  const { pointActionFor, overlay: pointingOverlay } = useEventPointing(city)
  const { user } = useAuth()
  const hasPremium = Boolean(user?.entitled)

  async function load() {
    await pullSkyEvents()
    const now = new Date()
    const planEnd = new Date(now.getTime() + eventLookaheadDays(hasPremium) * 86_400_000)
    const [upcoming, watched] = await Promise.all([getEventsInRange(now, planEnd), getWatchlist()])
    const localUpcoming = upcoming.filter((event) => isLocalEvent(event, city.lat, city.lon))
    const daysWithEvents = new Set(localUpcoming.map((event) => event.startsAt.slice(0, 10)))
    const guides = buildDailySkyGuideEvents(
      now,
      Math.min(eventLookaheadDays(hasPremium), SKY_GUIDE_WINDOW_DAYS),
      city.lat,
      city.lon,
    ).filter((guide) => !daysWithEvents.has(guide.startsAt.slice(0, 10)))
    setEvents([...guides, ...localUpcoming])
    setWatchlist(watched)
    setReminders(listGetReadyReminders())
    setPendingFeedback(listPendingReminderFeedback())
  }

  useEffect(() => {
    let cancelled = false
    load()
    fetchViewingForecast(city.lat, city.lon, forecastLookaheadDays(hasPremium))
      .then((forecast) => {
        if (cancelled) return
        setAdvisory(forecast.days)
        setAdvisoryTimeZone(city.timeZone ?? forecast.timeZone)
      })
      .catch(() => {
        if (!cancelled) setAdvisory([])
      })
    function refreshReminders() {
      setReminders(listGetReadyReminders())
      setPendingFeedback(listPendingReminderFeedback())
    }
    window.addEventListener('atlas:get-ready-reminders-changed', refreshReminders)
    window.addEventListener('atlas:reminder-feedback-changed', refreshReminders)
    return () => {
      cancelled = true
      window.removeEventListener('atlas:get-ready-reminders-changed', refreshReminders)
      window.removeEventListener('atlas:reminder-feedback-changed', refreshReminders)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- city identity is the intended reload boundary
  }, [city, hasPremium])

  const plannedEvents = useMemo(() => {
    const reminderIds = new Set(reminders.map((reminder) => reminder.eventId))
    return (events ?? [])
      .filter((event) => reminderIds.has(event.id) || matchesWatchlist(event, watchlist))
      .filter((event) => new Date(event.startsAt).getTime() <= Date.now() + 7 * 86_400_000)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, 5)
  }, [events, reminders, watchlist])

  const calendarGroups = useMemo(() => {
    const reminderIds = new Set(reminders.map((reminder) => reminder.eventId))
    const planned = (events ?? [])
      .filter((event) => reminderIds.has(event.id) || matchesWatchlist(event, watchlist))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    const groups: Array<{ dateKey: string; events: SkyEvent[] }> = []
    for (const event of planned) {
      const dateKey = event.startsAt.slice(0, 10)
      const last = groups[groups.length - 1]
      if (last?.dateKey === dateKey) last.events.push(event)
      else groups.push({ dateKey, events: [event] })
    }
    return groups
  }, [events, reminders, watchlist])

  function advisoryFor(event: SkyEvent): DailyViewingAdvisory | null {
    return advisory.find((day) => day.date === localDateKey(event.startsAt, advisoryTimeZone)) ?? null
  }

  function statusForEvent(event: SkyEvent): 'go' | 'marginal' | 'poor' | null {
    const day = advisoryFor(event)
    if (!day) return null
    const { rating } = scoreTonight({
      cloudCoverPct: day.cloudCoverPct,
      precipitationChancePct: day.precipitationChancePct,
      moonIlluminationPct: 50,
      hasBrightTarget: true,
    })
    return ratingToStatus(rating)
  }

  async function addReminder(event: SkyEvent) {
    if (!hasPremium) {
      setBlockedPlanAdd(true)
      setStatus('Sky Pass is required to add events to a plan. Browsing and check-ins stay free.')
      trackEvent('Blocked free plan add', { action: 'reminder', source: 'mobile_plan' })
      return
    }
    const hasPermission = await ensureNotificationPermission()
    await addGetReadyReminder({
      eventId: event.id,
      title: event.title,
      kind: event.kind,
      target: event.target,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      deviceName: CAMERA_PROFILES[getDefaultDevice()].name,
      lat: city.lat,
      lon: city.lon,
      cloudCoverPct: advisoryFor(event)?.cloudCoverPct,
      precipitationChancePct: advisoryFor(event)?.precipitationChancePct,
    })
    setReminders(listGetReadyReminders())
    setStatus(hasPermission ? 'Reminder armed.' : 'Saved in Atlas. Browser notifications are not enabled.')
    trackEvent('Added get ready reminder', { target: event.title, hasPermission, source: 'mobile_plan' })
  }

  async function toggleWatch(event: SkyEvent) {
    if (!hasPremium) {
      setBlockedPlanAdd(true)
      setStatus('Sky Pass is required to add events to a plan. Browsing and check-ins stay free.')
      trackEvent('Blocked free plan add', { action: 'watch', source: 'mobile_plan' })
      return
    }
    if (isWatching(watchlist, 'target', event.target)) {
      await removeFromWatchlist('target', event.target)
    } else {
      await addToWatchlist('target', event.target)
      onSavedForLater?.()
    }
    setWatchlist(await getWatchlist())
  }

  function submitFeedback(reminder: GetReadyReminder, outcome: ReminderFeedbackOutcome) {
    recordReminderFeedback(reminder.id, {
      outcome,
      note: feedbackNotes[reminder.id]?.trim() || undefined,
    })
    setPendingFeedback(listPendingReminderFeedback())
    setStatus(outcome === 'saw_it' ? 'Sighting logged. Atlas will trust harder targets a little more.' : 'Feedback saved.')
    trackEvent('Submitted reminder feedback', { outcome, target: reminder.title, kind: reminder.kind })
  }

  function blockFreePlanAdd(source: string) {
    setBlockedPlanAdd(true)
    setStatus('Sky Pass is required to add events to a plan. Browsing and check-ins stay free.')
    trackEvent('Blocked free plan add', { action: 'watch', source })
  }

  const selectedReminder = selected ? reminders.find((reminder) => reminder.eventId === selected.id) : null
  const selectedRecipeKey = selected ? recipeKeyForEventKind(selected.kind) : null
  const selectedAdvisory = selected ? advisoryFor(selected) : null

  const darkSites = useMemo(() => darkSitesSummary(city.lat, city.lon), [city.lat, city.lon])
  const gearFit = useMemo(() => defaultGearFitSummary(), [])
  const premiumPlanningGate = (
    <PaywallGate
      user={user}
      feature="Planning tools"
      description="Dark-sky trips, gear-fit planning, downloadable camera presets, and deeper camera setup are part of the Sky Pass."
      freeNote="Your first walkthrough, two-week local event browsing, check-ins, and private observation log stay free."
      onSignInClick={() => {
        window.location.href = '/app/settings'
      }}
    >
      {toolPanel === 'dark-sites' ? (
        <DarkSitesPanel lat={city.lat} lon={city.lon} cityName={city.name} onBack={() => setToolPanel(null)} />
      ) : (
        <GearFitPanel onBack={() => setToolPanel(null)} />
      )}
    </PaywallGate>
  )

  if (toolPanel === 'dark-sites') {
    return premiumPlanningGate
  }

  if (toolPanel === 'gear-fit') {
    return premiumPlanningGate
  }

  if (!hasPremium) {
    return (
      <div className="mobile-plan">
        <PaywallGate
          user={user}
          feature="Planning"
          description="Build observing plans, compare dark-sky trips, save events, and prepare gear with the Sky Pass."
          freeNote="Today, Events, check-ins, and your Journal stay free. Discounted users still need to complete Polar checkout first."
          freeBullets="Today's sky conditions, 10-day event browsing, check-ins, and your Journal."
          paidBullets="90-day plans, saved targets & reminders, dark-sky trip routing, gear fit, and downloadable camera presets."
          onSignInClick={() => {
            window.location.href = '/app/settings'
          }}
        >
          {null}
        </PaywallGate>
      </div>
    )
  }

  return (
    <div className="mobile-plan">
      <section className="mobile-card mobile-plan-index">
        <div className="mobile-plan-readout">
          <span className="mobile-plan-readout-count">
            <span className="mobile-plan-readout-dot" />
            {(events ?? []).length} EVENTS
          </span>
          <span className="mobile-plan-readout-window">NEXT {eventLookaheadDays(hasPremium)} DAYS</span>
        </div>
        <div className="mobile-community-tabs" aria-label="Plan sections">
          <button type="button" className={mode === 'browse' ? 'is-active' : ''} onClick={() => setMode('browse')}>
            Explore
          </button>
          <button type="button" className={mode === 'ready' ? 'is-active' : ''} onClick={() => setMode('ready')}>
            Ready<span className="mobile-plan-tab-count">{plannedEvents.length}</span>
          </button>
          <button type="button" className={mode === 'watchlist' ? 'is-active' : ''} onClick={() => setMode('watchlist')}>
            Watch
          </button>
          <button type="button" className={mode === 'calendar' ? 'is-active' : ''} onClick={() => setMode('calendar')}>
            Calendar
          </button>
        </div>
        {status && <p className="planner-reminder-status">{status}</p>}
      </section>
      {blockedPlanAdd && !hasPremium && (
        <PaywallGate
          user={user}
          feature="Add to plan"
          description="Saving targets, reminders, and holiday planning are part of the Sky Pass."
          freeNote="You can keep browsing local events and checking in for free."
          onSignInClick={() => {
            window.location.href = '/app/settings'
          }}
        >
          {null}
        </PaywallGate>
      )}

      {mode === 'ready' && (
        <section className="mobile-card">
          <div className="mobile-card-eyebrow">Next 7 days near {city.name}</div>
          {events === null ? (
            <p className="mobile-empty-hint">Loading&hellip;</p>
          ) : plannedEvents.length === 0 ? (
            <div className="mobile-plan-empty">
              <p className="mobile-empty-hint">Nothing planned yet. Watch an event type or find a specific event to prepare for.</p>
              <button type="button" className="mobile-primary-button" onClick={onOpenEvents}>
                Find events
              </button>
            </div>
          ) : (
            <div className="mobile-mini-list">
              {plannedEvents.map((event) => {
                const reminder = reminders.find((item) => item.eventId === event.id)
                const recipeKey = recipeKeyForEventKind(event.kind)
                return (
                  <button type="button" className="mobile-mini-row mobile-plan-row" key={event.id} onClick={() => setSelected(event)}>
                    <span className="mobile-event-kind">{KIND_LABELS[event.kind] ?? event.kind}</span>
                    <span className="mobile-mini-row-name">{event.title}</span>
                    <span className="mobile-mini-row-meta">{daysUntil(event.startsAt)}</span>
                    <span className="mobile-plan-row-status">
                      {reminder ? 'Reminder set' : 'Needs reminder'} · {recipeKey ? 'Setup ready' : 'Check gear'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      )}

      {pendingFeedback.length > 0 && (
        <section className="mobile-card mobile-feedback-checkin">
          <div className="mobile-card-eyebrow">After your window</div>
          <h3>Did you see it?</h3>
          {pendingFeedback.slice(0, 3).map((reminder) => (
            <div className="mobile-feedback-card" key={reminder.id}>
              <div>
                <strong>{reminder.title}</strong>
                <span>
                  {new Date(reminder.startsAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  {reminder.skippedReason ? ' · weather blocked the nudge' : ''}
                </span>
              </div>
              <div className="mobile-feedback-actions">
                <button type="button" onClick={() => submitFeedback(reminder, 'saw_it')}>
                  Saw it
                </button>
                <button type="button" onClick={() => submitFeedback(reminder, 'partial')}>
                  Partially
                </button>
                <button type="button" onClick={() => submitFeedback(reminder, 'clouded_out')}>
                  Clouded out
                </button>
              </div>
              <textarea
                value={feedbackNotes[reminder.id] ?? ''}
                onChange={(event) => setFeedbackNotes((current) => ({ ...current, [reminder.id]: event.target.value }))}
                placeholder="Optional note"
                rows={2}
              />
            </div>
          ))}
        </section>
      )}

      {mode === 'watchlist' && (
        <WatchView
          city={city}
          onSavedForLater={onSavedForLater}
          canAddToPlan={hasPremium}
          onBlockedPlanAdd={() => blockFreePlanAdd('mobile_plan_watchlist')}
        />
      )}

      {mode === 'calendar' && (
        <section className="mobile-card">
          <div className="mobile-card-eyebrow">Planned calendar</div>
          {events === null ? (
            <p className="mobile-empty-hint">Loading&hellip;</p>
          ) : calendarGroups.length === 0 ? (
            <p className="mobile-empty-hint">No planned or watched events in the next 90 days.</p>
          ) : (
            <div className="mobile-plan-calendar">
              {calendarGroups.map((group) => {
                const date = new Date(`${group.dateKey}T00:00:00`)
                return (
                  <section className="mobile-plan-day" key={group.dateKey}>
                    <div className="mobile-plan-day-stamp">
                      <strong>{date.getDate()}</strong>
                      <span>{date.toLocaleDateString(undefined, { month: 'short', weekday: 'short' })}</span>
                    </div>
                    <div className="mobile-mini-list">
                      {group.events.map((event) => (
                        <button type="button" className="mobile-mini-row mobile-plan-row" key={event.id} onClick={() => setSelected(event)}>
                          <span className="mobile-event-kind">{KIND_LABELS[event.kind] ?? event.kind}</span>
                          <span className="mobile-mini-row-name">{event.title}</span>
                          <span className="mobile-mini-row-meta">{formatEventDate(event.startsAt)}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </section>
      )}

      {mode === 'browse' && (
        <>
          <SkyEventBrowser events={events} onSelect={setSelected} statusForEvent={statusForEvent} />

          <section className="mobile-card">
            <div className="mobile-card-eyebrow">Planning tools</div>
            <div className="mobile-tool-cards">
              <button type="button" className="mobile-tool-card" onClick={() => setToolPanel('dark-sites')}>
                <span className="mobile-tool-card-icon mobile-tool-card-icon--rust">
                  <MobileIcon name="mountain" />
                </span>
                <span className="mobile-tool-card-body">
                  <strong>Dark sites</strong>
                  <span>Nearest dark-sky trip options</span>
                  <span className="mobile-tool-card-meta">
                    {darkSites.count} SITES · {darkSites.nearestMinutes ?? '—'} MIN
                  </span>
                </span>
                <MobileIcon name="chevron" />
              </button>
              <button type="button" className="mobile-tool-card" onClick={() => setToolPanel('gear-fit')}>
                <span className="mobile-tool-card-icon mobile-tool-card-icon--plum">
                  <MobileIcon name="camera" />
                </span>
                <span className="mobile-tool-card-body">
                  <strong>Gear fit</strong>
                  <span>Frame a target with your lens</span>
                  <span className="mobile-tool-card-meta">
                    {gearFit.focalLength} MM · {gearFit.sensorLabel}
                  </span>
                </span>
                <MobileIcon name="chevron" />
              </button>
            </div>
          </section>
        </>
      )}

      {selected && (
        <EventDetailPanel
          event={selected}
          onClose={() => setSelected(null)}
          bestViewingLabel={`${formatEventDate(selected.startsAt)} – ${new Date(selected.endsAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`}
          relevance={isLocalEvent(selected, city.lat, city.lon) ? 'local' : 'global'}
          conditions={{
            moonPct: moonIlluminationPctAt(new Date(selected.startsAt)),
            cloudPct: selectedAdvisory ? selectedAdvisory.cloudCoverPct : null,
            rainPct: selectedAdvisory ? selectedAdvisory.precipitationChancePct : null,
          }}
          forecastUnavailableHint={selectedAdvisory ? undefined : 'Cloud/rain forecast unavailable this far out — check closer to the date.'}
          watching={isWatching(watchlist, 'target', selected.target)}
          onToggleWatch={() => toggleWatch(selected)}
          reminderActive={!!selectedReminder}
          onRemind={() => addReminder(selected)}
          point={pointActionFor(selected)}
          onLogAttempt={() =>
            onLogAttempt({
              eventId: selected.id,
              targetName: selected.title,
              deviceUsed: CAMERA_PROFILES[getDefaultDevice()].name,
              cameraRecipeUsed: selectedRecipeKey ?? undefined,
              locationLabel: city.name,
              moonIlluminationPct: moonIlluminationPctAt(new Date(selected.startsAt)),
              cloudCoverPct: selectedAdvisory?.cloudCoverPct,
            })
          }
          recipeKey={selectedRecipeKey}
        />
      )}
      {pointingOverlay}
    </div>
  )
}

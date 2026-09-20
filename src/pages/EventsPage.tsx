import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MobileIcon, type MobileIconName } from '../components/mobile/MobileIcon'
import { EntryDetailView, type EntryDetailActions, type QuickActionOutcome } from '../views/mobile/EntryDetailView'
import { CAMERA_PROFILES, getDefaultDevice } from '../lib/cameraProfiles'
import { GUIDE_KIND_IDS, categoryForKind } from '../lib/eventCategories'
import { isVisibleLocalEvent } from '../lib/eventFilters'
import { addGetReadyReminder, ensureNotificationPermission, listGetReadyReminders } from '../lib/getReadyReminders'
import { getEventsInRange, pullSkyEvents } from '../lib/sync'
import { addToWatchlist, getWatchlist, isWatching, removeFromWatchlist, type WatchlistItem } from '../lib/watchlist'
import { getTaggedEventIds, toggleEventTag } from '../lib/eventTags'
import { trackEvent } from '../lib/analytics'
import { useAuth } from '../lib/auth'
import { buildEventDetail, detailInputFromEvent, type EntryDetailSubject } from '../lib/entryDetail'
import { metaFor } from '../lib/tonightTargets'
import { getDarknessWindow } from '../lib/darknessWindow'
import { tonightWindowForTimeZone } from '../lib/timeZone'
import { eventLookaheadDays } from '../lib/entitlementLimits'
import { dayGroupLabel, fetchViewingForecast, localDateKey } from '../lib/weather'
import { buildDailyObservingTargets, buildDailySkyGuideEvents, SKY_GUIDE_WINDOW_DAYS } from '../lib/visiblePlanets'
import { ensurePushSubscription, queueWatchConfirmation } from '../lib/push'
import { useThemeState } from '../lib/theme'
import type { CurrentLocation } from '../lib/currentLocation'
import type { ObservationDraft } from '../lib/observationDraft'
import type { SkyEvent } from '../lib/db'

export interface EventsPageProps {
  city: CurrentLocation
  onLogAttempt: (draft: ObservationDraft) => void
}

const INSTRUMENTS: Array<{ id: 'eye' | 'binoculars' | 'telescope'; label: string }> = [
  { id: 'eye', label: 'Naked eye' },
  { id: 'binoculars', label: 'Binoculars' },
  { id: 'telescope', label: 'Telescope' },
]

export function EventsPage({ city, onLogAttempt }: EventsPageProps) {
  const [theme] = useThemeState()
  const navigate = useNavigate()
  const [events, setEvents] = useState<SkyEvent[] | null>(null)
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [taggedIds, setTaggedIds] = useState<Set<string>>(new Set())
  const [reminders, setReminders] = useState(() => listGetReadyReminders())
  const [instrument, setInstrument] = useState<'eye' | 'binoculars' | 'telescope'>('eye')
  const [entryDetail, setEntryDetail] = useState<{ subject: EntryDetailSubject; actions: EntryDetailActions } | null>(null)
  const { user } = useAuth()
  const hasPremium = Boolean(user?.entitled)
  const lookaheadDays = eventLookaheadDays(hasPremium)

  useEffect(() => {
    let cancelled = false
    async function load() {
      await pullSkyEvents()
      const now = new Date()
      const end = new Date(now.getTime() + lookaheadDays * 86_400_000)
      const [upcoming, watched, tagged] = await Promise.all([getEventsInRange(now, end), getWatchlist(), getTaggedEventIds()])
      if (cancelled) return
      const catalogue = upcoming.filter((event) => isVisibleLocalEvent(event, city.lat, city.lon))
      // These are recalculated on-device, not saved into Dexie: their
      // positions belong to this observer rather than to a global event
      // catalogue. Limit the live observing layer to the near-term feed so a
      // Sky Pass's year-long calendar remains quick to open.
      const observingDays = Math.min(lookaheadDays, SKY_GUIDE_WINDOW_DAYS)
      const localGuides = buildDailySkyGuideEvents(now, observingDays, city.lat, city.lon)
      const observingTargets = buildDailyObservingTargets(now, observingDays, city.lat, city.lon)
      setEvents([...catalogue, ...localGuides, ...observingTargets])
      setWatchlist(watched)
      setTaggedIds(tagged)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [city.lat, city.lon, lookaheadDays])

  useEffect(() => {
    function refreshTags() {
      getTaggedEventIds().then(setTaggedIds)
    }
    window.addEventListener('atlas:tagged-events-changed', refreshTags)
    return () => window.removeEventListener('atlas:tagged-events-changed', refreshTags)
  }, [])

  const filtered = useMemo(() => {
    if (!events) return []
    // Guides (comet tracker, generic night-sky primers) are reference cards,
    // not a specific reachable target -- always shown regardless of
    // instrument, matching instrumentNote's carve-out below. Previously the
    // instrument row only changed this summary line's text; the visible
    // list itself never actually filtered by reachability.
    return events.filter((e) => {
      if (GUIDE_KIND_IDS.has(e.kind)) return true
      const meta = metaFor(e.kind)
      if (instrument === 'eye') return meta.nakedEyeVisible
      if (instrument === 'binoculars') return meta.nakedEyeVisible || meta.binocularFriendly === true
      return true
    })
  }, [events, instrument])

  const groups = useMemo(() => {
    if (!filtered.length) return []
    const todayKey = localDateKey(new Date().toISOString(), city.timeZone)
    const byDay = new Map<string, SkyEvent[]>()
    for (const event of filtered) {
      const key = localDateKey(event.startsAt, city.timeZone)
      if (!byDay.has(key)) byDay.set(key, [])
      byDay.get(key)!.push(event)
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, dayEvents]) => ({ key, label: dayGroupLabel(key, todayKey, city.timeZone), events: dayEvents }))
  }, [filtered, city.timeZone])

  const instrumentNote = useMemo(() => {
    if (!events) return ''
    const todayKey = localDateKey(new Date().toISOString(), city.timeZone)
    const tonight = events.filter((e) => localDateKey(e.startsAt, city.timeZone) === todayKey)
    // Guides (comet tracker, generic night-sky primers) are reference cards,
    // not a specific reachable target, and they're always shown below
    // regardless of instrument -- counting them here made this line read as
    // contradicting the list right underneath it (e.g. "0 targets reachable"
    // printed directly above four guide cards that were still visibly there).
    const targetsToday = tonight.filter((e) => !GUIDE_KIND_IDS.has(e.kind))
    const reachable = targetsToday.filter((e) => {
      const meta = metaFor(e.kind)
      if (instrument === 'eye') return meta.nakedEyeVisible
      if (instrument === 'binoculars') return meta.nakedEyeVisible || meta.binocularFriendly === true
      return true
    })
    if (targetsToday.length === 0) {
      return `No specific targets tonight from ${city.name} — see today's guide below.`
    }
    return `${reachable.length} of ${targetsToday.length} targets reachable tonight from ${city.name}.`
  }, [events, instrument, city.timeZone, city.name])

  async function toggleWatch(event: SkyEvent): Promise<QuickActionOutcome> {
    if (!hasPremium) {
      trackEvent('Blocked free plan add', { action: 'watch', source: 'mobile_events' })
      return { watching: false, message: 'Sky Pass is required to add events to a plan. Browsing and tonight’s check-ins stay free.' }
    }
    const nowWatching = !isWatching(watchlist, 'target', event.target)
    if (nowWatching) {
      await addToWatchlist('target', event.target)
      let pushMessage = ''
      try {
        const pushReady = await ensurePushSubscription()
        const confirmed = pushReady ? await queueWatchConfirmation({ id: event.id, title: event.title }) : false
        pushMessage = confirmed
          ? 'Watching. A confirmation notification is queued.'
          : pushReady
            ? 'Watching. Atlas will notify you about good viewing windows.'
            : 'Watching saved, but push is not enabled. Enable it in Profile to receive notifications.'
      } catch {
        pushMessage = 'Watching saved, but push setup needs attention in Profile.'
      }
      setWatchlist(await getWatchlist())
      return { watching: nowWatching, message: pushMessage }
    }
    await removeFromWatchlist('target', event.target)
    setWatchlist(await getWatchlist())
    return { watching: nowWatching, message: nowWatching ? 'Added to your watchlist.' : 'Removed from your watchlist.' }
  }

  async function toggleTag(event: SkyEvent): Promise<QuickActionOutcome> {
    const nowTagged = !taggedIds.has(event.id)
    await toggleEventTag(event.id, !nowTagged)
    if (nowTagged) await addReminder(event)
    setTaggedIds(await getTaggedEventIds())
    return { tagged: nowTagged, message: nowTagged ? 'Tagged — added to your feed filter and armed a reminder.' : 'Untagged.' }
  }

  async function addReminder(event: SkyEvent): Promise<QuickActionOutcome> {
    const hasPermission = await ensureNotificationPermission()
    let cloudCoverPct: number | undefined
    let precipitationChancePct: number | undefined
    try {
      const forecast = await fetchViewingForecast(city.lat, city.lon, 7)
      const day = forecast.days.find((item) => item.date === localDateKey(event.startsAt, forecast.timeZone))
      if (day) {
        cloudCoverPct = day.cloudCoverPct
        precipitationChancePct = day.precipitationChancePct
      }
    } catch {
      // Arm the reminder without a weather snapshot; the fire-time check
      // in getReadyReminders re-fetches live conditions anyway.
    }
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
      cloudCoverPct,
      precipitationChancePct,
    })
    setReminders(listGetReadyReminders())
    const message = hasPermission ? 'Reminder armed.' : 'Saved in Atlas. Browser notifications are not enabled.'
    trackEvent('Added get ready reminder', { target: event.title, hasPermission, source: 'mobile_events' })
    return { reminderActive: true, message }
  }

  function logEntryDetailAttempt() {
    if (!entryDetail) return
    const { subject } = entryDetail
    onLogAttempt({
      eventId: subject.id,
      targetName: subject.title,
      deviceUsed: CAMERA_PROFILES[getDefaultDevice()].name,
      cameraRecipeUsed: subject.recipeKey ?? undefined,
      locationLabel: city.name,
      moonIlluminationPct: subject.moonPct ?? undefined,
      directionLabel: subject.direction?.compassLabel,
    })
    setEntryDetail(null)
  }

  function selectEvent(event: SkyEvent) {
    const { start, end } = tonightWindowForTimeZone(new Date(event.startsAt), city.timeZone)
    const darknessWindow = getDarknessWindow(city.lat, city.lon, start, end)
    const subject = buildEventDetail(detailInputFromEvent(event, city, darknessWindow), null)
    const reminder = reminders.find((r) => r.eventId === event.id)
    setEntryDetail({
      subject,
      actions: {
        watching: isWatching(watchlist, 'target', event.target),
        onToggleWatch: () => toggleWatch(event),
        reminderActive: !!reminder,
        onRemind: () => addReminder(event),
        tagged: taggedIds.has(event.id),
        onToggleTag: () => toggleTag(event),
      },
    })
  }

  return (
    <div className="az-page">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1 className="az-h1">Events</h1>
          <p className="az-hero-title">{events ? `${filtered.length} things to see` : 'Finding tonight’s sky…'}</p>
        </div>
        <button type="button" className="az-text-btn" onClick={() => navigate('/app/calendar')}>
          Calendar
        </button>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.875rem', color: 'var(--muted)', fontSize: '0.8125rem' }}>
        <span>Viewing with</span>
        <select value={instrument} onChange={(event) => setInstrument(event.target.value as typeof instrument)} aria-label="Viewing equipment">
          {INSTRUMENTS.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
        </select>
        <span aria-live="polite">· {instrumentNote}</span>
      </label>

      {groups.map((group) => (
          <div key={group.key} style={{ marginTop: '1.125rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
              <span className="az-kicker">{group.label}</span>
              <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            </div>
            <div className="az-row-group">
              {group.events.map((event) => (
                <button type="button" key={event.id} className="az-row" onClick={() => selectEvent(event)}>
                  <span className="az-row-icon">
                    <MobileIcon name={(categoryForKind(event.kind)?.icon as MobileIconName) ?? 'zap'} />
                  </span>
                  <span className="az-row-main">
                    <span className="az-row-kind">{categoryForKind(event.kind)?.label.toUpperCase() ?? event.kind}</span>
                    <span className="az-row-title">{event.title}</span>
                  </span>
                  <span className="az-row-trail">
                    <span className="az-row-time">
                      {new Date(event.startsAt).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                        // The event happens over the observing location, so
                        // show it in that zone rather than the device's.
                        timeZone: city.timeZone,
                      })}
                    </span>
                  </span>
                  <span className="az-row-chevron">
                    <MobileIcon name="chevron" size={14} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

      {entryDetail && (
        <EntryDetailView
          subject={entryDetail.subject}
          actions={entryDetail.actions}
          onClose={() => setEntryDetail(null)}
          onLogAttempt={logEntryDetailAttempt}
          dark={theme === 'dark'}
        />
      )}
    </div>
  )
}

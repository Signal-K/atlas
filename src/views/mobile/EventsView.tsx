import { useEffect, useMemo, useRef, useState } from 'react'
import '../../pages/dt-shared.css'
import { CAMERA_PROFILES, getDefaultDevice } from '../../lib/cameraProfiles'
import { isLocalEvent } from '../../lib/eventFilters'
import { addGetReadyReminder, ensureNotificationPermission, listGetReadyReminders, type GetReadyReminder } from '../../lib/getReadyReminders'
import { getEventsInRange, pullSkyEvents } from '../../lib/sync'
import { addToWatchlist, getWatchlist, isWatching, removeFromWatchlist, type WatchlistItem } from '../../lib/watchlist'
import { fetchViewingForecast, localDateKey, type DailyViewingAdvisory } from '../../lib/weather'
import { moonIlluminationPctAt } from '../../lib/moonPhase'
import { trackEvent } from '../../lib/analytics'
import { useAuth } from '../../lib/auth'
import { useEventPointing } from '../../components/mobile/EventPointing'
import { SkyEventBrowser } from '../../components/mobile/SkyEventBrowser'
import { MobileIcon } from '../../components/mobile/MobileIcon'
import { categoryForKind } from '../../lib/eventCategories'
import { KIND_LABELS } from '../../widgets/EventRow'
import { eventLookaheadDays, forecastLookaheadDays } from '../../lib/entitlementLimits'
import { buildDailySkyGuideEvents, SKY_GUIDE_WINDOW_DAYS } from '../../lib/visiblePlanets'
import { CITIES, cityLabel, type City } from '../../lib/cities'
import { buildEventDetail, detailInputFromEvent, type EntryDetailSubject } from '../../lib/entryDetail'
import type { EntryDetailActions, QuickActionOutcome } from './EntryDetailView'
import { requestEclipseRoadmap } from '../../lib/eclipseRoadmap'
import { getDarknessWindow } from '../../lib/darknessWindow'
import { tonightWindowForTimeZone } from '../../lib/timeZone'
import { daysUntil } from '../../lib/eventFormat'
import type { CurrentLocation } from '../../lib/currentLocation'
import type { SkyEvent } from '../../lib/db'

// How far out an eclipse/meteor shower still counts as "coming up" rather
// than just another list entry.
const MAJOR_EVENT_WINDOW_DAYS = 14

export function EventsView({
  city,
  onSavedForLater,
  onOpenEntry,
}: {
  city: CurrentLocation
  onSavedForLater?: () => void
  onOpenEntry: (subject: EntryDetailSubject, actions?: EntryDetailActions) => void
}) {
  const [events, setEvents] = useState<SkyEvent[] | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [reminders, setReminders] = useState<GetReadyReminder[]>(() => listGetReadyReminders())
  const [advisory, setAdvisory] = useState<DailyViewingAdvisory[]>([])
  const [advisoryTimeZone, setAdvisoryTimeZone] = useState<string | undefined>(city.timeZone)
  const [browseCity, setBrowseCity] = useState<City | null>(null)
  const [browseQuery, setBrowseQuery] = useState('')
  const pendingNextEventRef = useRef(false)
  const { user } = useAuth()
  const hasPremium = Boolean(user?.entitled)

  // Sky Pass lets you browse and plan for a location other than your own;
  // free accounts are limited to their own location (see
  // entitlementLimits.ts). Dropping the paid pick on downgrade avoids
  // silently stranding a free account browsing a city it can no longer see.
  useEffect(() => {
    if (!hasPremium) setBrowseCity(null)
  }, [hasPremium])

  const viewLocation: CurrentLocation = browseCity
    ? { name: cityLabel(browseCity), lat: browseCity.lat, lon: browseCity.lon, source: 'manual', timeZone: browseCity.timeZone }
    : city
  const { pointActionFor, overlay: pointingOverlay } = useEventPointing(viewLocation)
  const lookaheadDays = eventLookaheadDays(hasPremium)
  const forecastDays = forecastLookaheadDays(hasPremium)

  async function refresh() {
    await pullSkyEvents()
    const now = new Date()
    const lookaheadEnd = new Date(now.getTime() + lookaheadDays * 86_400_000)
    const [upcoming, watched] = await Promise.all([getEventsInRange(now, lookaheadEnd), getWatchlist()])
    const localUpcoming = upcoming.filter((event) => isLocalEvent(event, viewLocation.lat, viewLocation.lon))
    const daysWithEvents = new Set(localUpcoming.map((event) => localDateKey(event.startsAt, viewLocation.timeZone)))
    const guides = buildDailySkyGuideEvents(
      new Date(),
      Math.min(lookaheadDays, SKY_GUIDE_WINDOW_DAYS),
      viewLocation.lat,
      viewLocation.lon,
    ).filter((guide) => !daysWithEvents.has(localDateKey(guide.startsAt, viewLocation.timeZone)))
    setEvents([...guides, ...localUpcoming])
    setWatchlist(watched)
    setReminders(listGetReadyReminders())
  }

  useEffect(() => {
    refresh()
    fetchViewingForecast(viewLocation.lat, viewLocation.lon, forecastDays)
      .then((forecast) => {
        setAdvisory(forecast.days)
        setAdvisoryTimeZone(viewLocation.timeZone ?? forecast.timeZone)
      })
      .catch(() => setAdvisory([]))
    function refreshReminders() {
      setReminders(listGetReadyReminders())
    }
    window.addEventListener('atlas:get-ready-reminders-changed', refreshReminders)
    return () => window.removeEventListener('atlas:get-ready-reminders-changed', refreshReminders)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- viewLocation identity is the reload boundary
  }, [viewLocation.lat, viewLocation.lon, lookaheadDays, forecastDays])

  function advisoryFor(event: SkyEvent): DailyViewingAdvisory | null {
    return advisory.find((day) => day.date === localDateKey(event.startsAt, advisoryTimeZone)) ?? null
  }

  // Returns the outcome so the caller -- the EntryDetailView overlay -- can
  // show its own confirmation/paywall feedback (KES-179). toggleWatch and
  // addReminder are only ever invoked through that overlay, so the message
  // lives solely in its quickActionMessage state, not duplicated here.
  async function toggleWatch(event: SkyEvent): Promise<QuickActionOutcome> {
    if (!hasPremium) {
      const message = 'Sky Pass is required to add events to a plan. Browsing and check-ins stay free.'
      trackEvent('Blocked free plan add', { action: 'watch', source: 'mobile_events' })
      return { watching: false, message }
    }
    const nowWatching = !isWatching(watchlist, 'target', event.target)
    if (nowWatching) {
      await addToWatchlist('target', event.target)
      onSavedForLater?.()
    } else {
      await removeFromWatchlist('target', event.target)
    }
    setWatchlist(await getWatchlist())
    return { watching: nowWatching, message: nowWatching ? 'Added to your watchlist.' : 'Removed from your watchlist.' }
  }

  async function addReminder(event: SkyEvent): Promise<QuickActionOutcome> {
    const hasPermission = await ensureNotificationPermission()
    await addGetReadyReminder({
      eventId: event.id,
      title: event.title,
      kind: event.kind,
      target: event.target,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      deviceName: CAMERA_PROFILES[getDefaultDevice()].name,
      lat: viewLocation.lat,
      lon: viewLocation.lon,
      cloudCoverPct: advisoryFor(event)?.cloudCoverPct,
      precipitationChancePct: advisoryFor(event)?.precipitationChancePct,
    })
    setReminders(listGetReadyReminders())
    const message = hasPermission ? 'Reminder armed.' : 'Saved in Atlas. Browser notifications are not enabled.'
    trackEvent('Added get ready reminder', { target: event.title, hasPermission, source: 'mobile_events' })
    return { reminderActive: true, message }
  }

  function selectBrowseCity(cityName: string) {
    if (!hasPremium) return
    if (!cityName) {
      setBrowseCity(null)
      trackEvent('Browsed other location', { action: 'reset', source: 'mobile_events' })
      return
    }
    const next = CITIES.find((candidate) => candidate.name === cityName)
    if (!next) return
    setBrowseCity(next)
    trackEvent('Browsed other location', { action: 'select', city: next.name, source: 'mobile_events' })
  }

  const browseResults = useMemo(
    () =>
      CITIES.filter((candidate) => cityLabel(candidate).toLocaleLowerCase().includes(browseQuery.trim().toLocaleLowerCase())).slice(0, 8),
    [browseQuery],
  )

  const moonPct = Math.round(moonIlluminationPctAt(new Date()))
  const isBrowsingElsewhere = browseCity != null
  const todayKey = localDateKey(new Date().toISOString(), viewLocation.timeZone)
  const todaysEvents = useMemo(
    () =>
      (events ?? [])
        .filter((event) => localDateKey(event.startsAt, viewLocation.timeZone) === todayKey)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [events, viewLocation.timeZone, todayKey],
  )
  const todayEventCount = todaysEvents.length
  const todayAdvisory = advisory.find((day) => day.date === todayKey) ?? null

  const majorEvents = useMemo(() => {
    const windowEnd = Date.now() + MAJOR_EVENT_WINDOW_DAYS * 86_400_000
    return (events ?? [])
      .filter((event) => (event.kind === 'eclipse' || event.kind === 'meteor_shower') && new Date(event.startsAt).getTime() <= windowEnd)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, 2)
  }, [events])

  function selectEvent(event: SkyEvent) {
    setSelectedEventId(event.id)
    const { start, end } = tonightWindowForTimeZone(new Date(event.startsAt), viewLocation.timeZone)
    const darknessWindow = getDarknessWindow(viewLocation.lat, viewLocation.lon, start, end)
    const subject = buildEventDetail(detailInputFromEvent(event, viewLocation, darknessWindow), advisoryFor(event))
    const reminder = reminders.find((candidate) => candidate.eventId === event.id)
    onOpenEntry(subject, {
      watching: isWatching(watchlist, 'target', event.target),
      onToggleWatch: () => toggleWatch(event),
      reminderActive: !!reminder,
      onRemind: () => addReminder(event),
      onPoint: pointActionFor(event)?.onPoint,
      roadmap:
        event.kind === 'eclipse'
          ? {
              locked: !hasPremium,
              generate: hasPremium
                ? () =>
                    requestEclipseRoadmap({
                      title: subject.title,
                      locationName: viewLocation.name,
                      lat: viewLocation.lat,
                      lon: viewLocation.lon,
                      timeZone: viewLocation.timeZone,
                      guideSteps: subject.guideSteps ?? [],
                    })
                : undefined,
            }
          : undefined,
    })
  }

  useEffect(() => {
    function handleMobileHome() {
      pendingNextEventRef.current = false
      setSelectedEventId(null)
    }

    // The dock dispatches this as soon as it's tapped, which can land
    // before the initial sky-events fetch (events still null/empty) --
    // e.g. right after route entry. Rather than silently no-opping the
    // tap, remember it and honor it once events finish loading (the
    // effect re-runs below whenever `events` changes).
    function handleNextEvent() {
      const sequence = (events ?? [])
        .filter((event) => isLocalEvent(event, viewLocation.lat, viewLocation.lon))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      if (sequence.length === 0) {
        pendingNextEventRef.current = true
        return
      }
      pendingNextEventRef.current = false
      const currentIndex = selectedEventId ? sequence.findIndex((event) => event.id === selectedEventId) : -1
      const nextEvent = sequence[(currentIndex + 1) % sequence.length]
      if (nextEvent) selectEvent(nextEvent)
    }

    if (pendingNextEventRef.current) handleNextEvent()

    window.addEventListener('atlas:mobile-home', handleMobileHome)
    window.addEventListener('atlas:next-event', handleNextEvent)
    return () => {
      window.removeEventListener('atlas:mobile-home', handleMobileHome)
      window.removeEventListener('atlas:next-event', handleNextEvent)
    }
    // selectEvent is intentionally the local action invoked by the dock;
    // these values are the event sequence and current position it operates on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, selectedEventId, viewLocation.lat, viewLocation.lon])

  const hasNotificationsOrFlagships = reminders.length > 0 || majorEvents.length > 0

  return (
    <div className="dt-page">
      <div className="dt-masthead">
        <span className="dt-kicker">Today · {viewLocation.name}</span>
        <h2 className="dt-h2">Tonight&rsquo;s sky</h2>
      </div>

      {/* 1. Today's events -- what's actually on tonight, before any numbers
          or notices, since that's the one thing worth a glance every visit. */}
      <section className="dt-section" aria-label="Today’s events">
        {todaysEvents.length === 0 ? (
          <p className="dt-empty-hint">Nothing on the schedule for tonight yet.</p>
        ) : (
          <div className="dt-today-list">
            {todaysEvents.map((event) => {
              const eventCategory = categoryForKind(event.kind)
              return (
                <button type="button" className="dt-feed-row dt-feed-row--listing" key={event.id} onClick={() => selectEvent(event)}>
                  <span className="dt-feed-swatch" style={eventCategory ? { color: eventCategory.accent } : undefined}>
                    {event.imageUrl ? <img src={event.imageUrl} alt="" loading="lazy" /> : <MobileIcon name={eventCategory?.icon ?? 'zap'} />}
                  </span>
                  <span className="dt-feed-body">
                    <span className="dt-feed-kind">{KIND_LABELS[event.kind] ?? event.kind}</span>
                    <span className="dt-feed-headline">{event.title}</span>
                  </span>
                  <span className="dt-feed-time">
                    {new Date(event.startsAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: viewLocation.timeZone })}
                  </span>
                  <span className="dt-feed-chevron">
                    <MobileIcon name="chevron" />
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <div className="dt-seam" />

      {/* 2. Today's stats. */}
      <div className="dt-today-stats" aria-label="Today’s sky statistics">
        <span><strong>{events === null ? '—' : todayEventCount}</strong> today</span>
        <span><strong>{todayAdvisory?.cloudCoverPct == null ? '—' : `${100 - Math.round(todayAdvisory.cloudCoverPct)}%`}</strong> clear</span>
        <span><strong>{moonPct}%</strong> moon</span>
        <span><strong>{events === null ? '—' : events.length}</strong> upcoming</span>
      </div>

      {/* 3. Notifications & flagships -- armed reminders plus any eclipse or
          meteor shower coming up soon, grouped under one heading. */}
      {hasNotificationsOrFlagships && (
        <>
          <div className="dt-seam" />
          <section className="dt-section" aria-label="Notifications and flagship events">
            <div className="dt-section-heading">
              <span className="dt-kicker">Notifications &amp; flagships</span>
            </div>
            {reminders.length > 0 && (
              <div className="dt-notification-strip" role="status">
                <strong>{reminders.length} reminder{reminders.length === 1 ? '' : 's'} armed</strong>
                <span>Atlas will get you ready before the next saved event.</span>
              </div>
            )}
            {majorEvents.length > 0 && (
              <div className="dt-major-events">
                {majorEvents.map((event) => {
                  const nowIso = new Date().toISOString()
                  const inProgress = event.startsAt <= nowIso && event.endsAt >= nowIso
                  return (
                    <button type="button" className="dt-major-event-card is-featured" key={event.id} onClick={() => selectEvent(event)}>
                      {event.imageUrl && <img src={event.imageUrl} alt="" loading="lazy" />}
                      <div className="dt-major-event-body">
                        <span className="dt-major-event-badge">
                          {event.kind === 'eclipse' ? 'ECLIPSE' : 'METEOR SHOWER'} · {inProgress ? 'HAPPENING NOW' : daysUntil(event.startsAt)}
                        </span>
                        <strong>{event.title}</strong>
                        <span className="dt-major-event-desc">{event.description}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}

      <div className="dt-seam" />

      <div className="dt-browse-location">
        {hasPremium ? (
          <div className="dt-browse-location-picker">
            <span>{isBrowsingElsewhere ? `Browsing ${viewLocation.name}` : `Your location: ${city.name}`}</span>
            <input
              type="search"
              value={browseQuery}
              onChange={(event) => setBrowseQuery(event.currentTarget.value)}
              placeholder="Search another city"
              aria-label="Search another city"
            />
            {browseQuery.trim() && (
              <div className="dt-browse-location-results" role="listbox" aria-label="Location results">
                {browseResults.map((option) => (
                  <button
                    type="button"
                    key={option.name}
                    onClick={() => {
                      selectBrowseCity(option.name)
                      setBrowseQuery('')
                    }}
                  >
                    {cityLabel(option)}
                  </button>
                ))}
                <button type="button" onClick={() => { selectBrowseCity(''); setBrowseQuery('') }}>
                  Use {city.name}
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="dt-browse-location-locked">Sky Pass unlocks browsing events in other locations.</p>
        )}
      </div>

      <div className="dt-seam" />

      {/* 4. All events: one chronological, date-grouped calendar feed. */}
      <SkyEventBrowser events={events} onSelect={selectEvent} />
      {pointingOverlay}
    </div>
  )
}

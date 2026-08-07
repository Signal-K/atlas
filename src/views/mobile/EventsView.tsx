import { useEffect, useMemo, useState } from 'react'
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
import { eventLookaheadDays, forecastLookaheadDays } from '../../lib/entitlementLimits'
import { buildDailySkyGuideEvents, SKY_GUIDE_WINDOW_DAYS } from '../../lib/visiblePlanets'
import { CITIES, cityLabel, type City } from '../../lib/cities'
import { buildEventDetail, detailInputFromEvent, type EntryDetailSubject } from '../../lib/entryDetail'
import { getDarknessWindow } from '../../lib/darknessWindow'
import { tonightWindowForTimeZone } from '../../lib/timeZone'
import type { CurrentLocation } from '../../lib/currentLocation'
import type { SkyEvent } from '../../lib/db'

export function EventsView({
  city,
  onSavedForLater,
  onOpenEntry,
}: {
  city: CurrentLocation
  onSavedForLater?: () => void
  onOpenEntry: (subject: EntryDetailSubject, actions?: { watching?: boolean; onToggleWatch?: () => void; reminderActive?: boolean; onRemind?: () => void; onPoint?: () => void }) => void
}) {
  const [events, setEvents] = useState<SkyEvent[] | null>(null)
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [reminders, setReminders] = useState<GetReadyReminder[]>(() => listGetReadyReminders())
  const [advisory, setAdvisory] = useState<DailyViewingAdvisory[]>([])
  const [advisoryTimeZone, setAdvisoryTimeZone] = useState<string | undefined>(city.timeZone)
  const [status, setStatus] = useState('')
  const [browseCity, setBrowseCity] = useState<City | null>(null)
  const [browseQuery, setBrowseQuery] = useState('')
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

  async function toggleWatch(event: SkyEvent) {
    if (!hasPremium) {
      setStatus('Sky Pass is required to add events to a plan. Browsing and check-ins stay free.')
      trackEvent('Blocked free plan add', { action: 'watch', source: 'mobile_events' })
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

  async function addReminder(event: SkyEvent) {
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
    setStatus(hasPermission ? 'Reminder armed.' : 'Saved in Atlas. Browser notifications are not enabled.')
    trackEvent('Added get ready reminder', { target: event.title, hasPermission, source: 'mobile_events' })
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

  function selectEvent(event: SkyEvent) {
    const { start, end } = tonightWindowForTimeZone(new Date(event.startsAt), viewLocation.timeZone)
    const darknessWindow = getDarknessWindow(viewLocation.lat, viewLocation.lon, start, end)
    const subject = buildEventDetail(
      detailInputFromEvent(event, viewLocation.lat, viewLocation.lon, darknessWindow),
      advisoryFor(event),
    )
    const reminder = reminders.find((candidate) => candidate.eventId === event.id)
    onOpenEntry(subject, {
      watching: isWatching(watchlist, 'target', event.target),
      onToggleWatch: () => toggleWatch(event),
      reminderActive: !!reminder,
      onRemind: () => addReminder(event),
      onPoint: pointActionFor(event)?.onPoint,
    })
  }

  return (
    <div className="dt-page">
      <div className="dt-masthead">
        <span className="dt-kicker">Sky dispatch</span>
        <h2 className="dt-h2">Tonight&rsquo;s sky, reported.</h2>
        <div className="dt-masthead-readout">
          {events ? events.length : 0} UPCOMING &middot; NEXT {lookaheadDays >= 365 ? 'ALL' : lookaheadDays} DAYS &middot; MOON {moonPct}%
        </div>
      </div>

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
          <p className="dt-browse-location-locked">Sky Pass unlocks browsing events in other locations — you&rsquo;re seeing {city.name}.</p>
        )}
      </div>

      {status && <p className="planner-reminder-status">{status}</p>}
      <div className="dt-seam" />
      <SkyEventBrowser events={events} onSelect={selectEvent} />
      {pointingOverlay}
    </div>
  )
}

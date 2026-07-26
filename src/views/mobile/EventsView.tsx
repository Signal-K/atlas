import { useEffect, useMemo, useState } from 'react'
import { recipeKeyForEventKind } from '../../lib/cameraRecipes'
import { CAMERA_PROFILES, getDefaultDevice } from '../../lib/cameraProfiles'
import { isLocalEvent } from '../../lib/eventFilters'
import { addGetReadyReminder, ensureNotificationPermission, listGetReadyReminders, type GetReadyReminder } from '../../lib/getReadyReminders'
import { getUpcomingEvents, pullSkyEvents } from '../../lib/sync'
import { addToWatchlist, getWatchlist, isWatching, removeFromWatchlist, type WatchlistItem } from '../../lib/watchlist'
import { fetchViewingForecast, localDateKey, type DailyViewingAdvisory } from '../../lib/weather'
import { moonIlluminationPctAt } from '../../lib/moonPhase'
import { formatEventDate } from '../../lib/eventFormat'
import { trackEvent } from '../../lib/analytics'
import { useAuth } from '../../lib/auth'
import { EventDetailPanel } from '../../components/mobile/EventDetailPanel'
import { useEventPointing } from '../../components/mobile/EventPointing'
import { SkyEventBrowser } from '../../components/mobile/SkyEventBrowser'
import { eventLookaheadDays, forecastLookaheadDays } from '../../lib/entitlementLimits'
import { buildDailySkyGuideEvents, SKY_GUIDE_WINDOW_DAYS } from '../../lib/visiblePlanets'
import { CITIES, cityLabel, type City } from '../../lib/cities'
import type { CurrentLocation } from '../../lib/currentLocation'
import type { SkyEvent } from '../../lib/db'
import type { ObservationDraft } from '../../lib/observationDraft'

export function EventsView({
  city,
  onLogAttempt,
  onSavedForLater,
}: {
  city: CurrentLocation
  onLogAttempt: (draft: ObservationDraft) => void
  onSavedForLater?: () => void
}) {
  const [events, setEvents] = useState<SkyEvent[] | null>(null)
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [reminders, setReminders] = useState<GetReadyReminder[]>(() => listGetReadyReminders())
  const [selected, setSelected] = useState<SkyEvent | null>(null)
  const [advisory, setAdvisory] = useState<DailyViewingAdvisory[]>([])
  const [advisoryTimeZone, setAdvisoryTimeZone] = useState<string | undefined>(city.timeZone)
  const [status, setStatus] = useState('')
  const [browseCity, setBrowseCity] = useState<City | null>(null)
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
    const [upcoming, watched] = await Promise.all([getUpcomingEvents(lookaheadDays), getWatchlist()])
    const localUpcoming = upcoming.filter((event) => isLocalEvent(event, viewLocation.lat, viewLocation.lon))
    const daysWithEvents = new Set(localUpcoming.map((event) => event.startsAt.slice(0, 10)))
    const guides = buildDailySkyGuideEvents(
      new Date(),
      Math.min(lookaheadDays, SKY_GUIDE_WINDOW_DAYS),
      viewLocation.lat,
      viewLocation.lon,
    ).filter((guide) => !daysWithEvents.has(guide.startsAt.slice(0, 10)))
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

  const sortedCities = useMemo(() => [...CITIES].sort((a, b) => cityLabel(a).localeCompare(cityLabel(b))), [])

  const recipeKey = selected ? recipeKeyForEventKind(selected.kind) : null
  const selectedReminder = selected ? reminders.find((reminder) => reminder.eventId === selected.id) : null
  const selectedAdvisory = selected ? advisoryFor(selected) : null
  const moonPct = Math.round(moonIlluminationPctAt(new Date()))
  const isBrowsingElsewhere = browseCity != null

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
          <label className="dt-browse-location-picker">
            <span>{isBrowsingElsewhere ? 'Browsing' : 'Location'}</span>
            <select value={browseCity?.name ?? ''} onChange={(event) => selectBrowseCity(event.target.value)}>
              <option value="">{city.name} (my location)</option>
              {sortedCities.map((option) => (
                <option key={option.name} value={option.name}>
                  {cityLabel(option)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="dt-browse-location-locked">Sky Pass unlocks browsing events in other locations — you&rsquo;re seeing {city.name}.</p>
        )}
      </div>

      {status && <p className="planner-reminder-status">{status}</p>}
      <div className="dt-seam" />
      <SkyEventBrowser events={events} onSelect={setSelected} />

      {selected && (
        <EventDetailPanel
          event={selected}
          onClose={() => setSelected(null)}
          bestViewingLabel={`${formatEventDate(selected.startsAt)} – ${new Date(selected.endsAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`}
          relevance={isLocalEvent(selected, viewLocation.lat, viewLocation.lon) ? 'local' : 'global'}
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
              cameraRecipeUsed: recipeKey ?? undefined,
              locationLabel: viewLocation.name,
              moonIlluminationPct: moonIlluminationPctAt(new Date(selected.startsAt)),
              cloudCoverPct: selectedAdvisory?.cloudCoverPct,
            })
          }
          recipeKey={recipeKey}
        />
      )}
      {pointingOverlay}
    </div>
  )
}

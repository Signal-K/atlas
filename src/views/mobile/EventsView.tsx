import { useEffect, useState } from 'react'
import { recipeKeyForEventKind } from '../../lib/cameraRecipes'
import { CAMERA_PROFILES, getDefaultDevice } from '../../lib/cameraProfiles'
import { isLocalEvent } from '../../lib/eventFilters'
import { addGetReadyReminder, ensureNotificationPermission, listGetReadyReminders, type GetReadyReminder } from '../../lib/getReadyReminders'
import { getUpcomingEvents, pullSkyEvents } from '../../lib/sync'
import { addToWatchlist, getWatchlist, isWatching, removeFromWatchlist, type WatchlistItem } from '../../lib/watchlist'
import { fetchViewingAdvisory, type DailyViewingAdvisory } from '../../lib/weather'
import { moonIlluminationPctAt } from '../../lib/moonPhase'
import { formatEventDate } from '../../lib/eventFormat'
import { trackEvent } from '../../lib/analytics'
import { EventDetailPanel } from '../../components/mobile/EventDetailPanel'
import { useEventPointing } from '../../components/mobile/EventPointing'
import { SkyEventBrowser } from '../../components/mobile/SkyEventBrowser'
import type { CurrentLocation } from '../../lib/currentLocation'
import type { SkyEvent } from '../../lib/db'
import type { ObservationDraft } from '../../lib/observationDraft'

export function EventsView({ city, onLogAttempt }: { city: CurrentLocation; onLogAttempt: (draft: ObservationDraft) => void }) {
  const [events, setEvents] = useState<SkyEvent[] | null>(null)
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [reminders, setReminders] = useState<GetReadyReminder[]>(() => listGetReadyReminders())
  const [selected, setSelected] = useState<SkyEvent | null>(null)
  const [advisory, setAdvisory] = useState<DailyViewingAdvisory[]>([])
  const { pointActionFor, overlay: pointingOverlay } = useEventPointing(city)

  async function refresh() {
    await pullSkyEvents()
    const [upcoming, watched] = await Promise.all([getUpcomingEvents(240), getWatchlist()])
    setEvents(upcoming.filter((event) => isLocalEvent(event, city.lat, city.lon)))
    setWatchlist(watched)
    setReminders(listGetReadyReminders())
  }

  useEffect(() => {
    refresh()
    fetchViewingAdvisory(city.lat, city.lon, 7)
      .then(setAdvisory)
      .catch(() => setAdvisory([]))
    function refreshReminders() {
      setReminders(listGetReadyReminders())
    }
    window.addEventListener('atlas:get-ready-reminders-changed', refreshReminders)
    return () => window.removeEventListener('atlas:get-ready-reminders-changed', refreshReminders)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- city identity is the reload boundary
  }, [city])

  function advisoryFor(event: SkyEvent): DailyViewingAdvisory | null {
    return advisory.find((day) => day.date === event.startsAt.slice(0, 10)) ?? null
  }

  async function toggleWatch(event: SkyEvent) {
    if (isWatching(watchlist, 'target', event.target)) await removeFromWatchlist('target', event.target)
    else await addToWatchlist('target', event.target)
    setWatchlist(await getWatchlist())
  }

  async function addReminder(event: SkyEvent) {
    const hasPermission = await ensureNotificationPermission()
    await addGetReadyReminder({
      eventId: event.id,
      title: event.title,
      startsAt: event.startsAt,
      deviceName: CAMERA_PROFILES[getDefaultDevice()].name,
    })
    setReminders(listGetReadyReminders())
    trackEvent('Added get ready reminder', { target: event.title, hasPermission, source: 'mobile_events' })
  }

  const recipeKey = selected ? recipeKeyForEventKind(selected.kind) : null
  const selectedReminder = selected ? reminders.find((reminder) => reminder.eventId === selected.id) : null
  const selectedAdvisory = selected ? advisoryFor(selected) : null
  const moonPct = Math.round(moonIlluminationPctAt(new Date()))

  return (
    <div className="dt-page">
      <div className="dt-masthead">
        <span className="dt-kicker">Sky dispatch</span>
        <h2 className="dt-h2">Tonight&rsquo;s sky, reported.</h2>
        <div className="dt-masthead-readout">
          {events ? events.length : 0} UPCOMING &middot; MOON {moonPct}%
        </div>
      </div>
      <div className="dt-seam" />
      <SkyEventBrowser events={events} onSelect={setSelected} />

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
              cameraRecipeUsed: recipeKey ?? undefined,
              locationLabel: city.name,
            })
          }
          recipeKey={recipeKey}
        />
      )}
      {pointingOverlay}
    </div>
  )
}

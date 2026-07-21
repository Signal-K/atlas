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
import { useAuth } from '../../lib/auth'
import { EventDetailPanel } from '../../components/mobile/EventDetailPanel'
import { useEventPointing } from '../../components/mobile/EventPointing'
import { SkyEventBrowser } from '../../components/mobile/SkyEventBrowser'
import type { CurrentLocation } from '../../lib/currentLocation'
import type { SkyEvent } from '../../lib/db'
import type { ObservationDraft } from '../../lib/observationDraft'

const FREE_EVENT_LOOKAHEAD_DAYS = 14
const PREMIUM_EVENT_LOOKAHEAD_DAYS = 90

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
  const [status, setStatus] = useState('')
  const { pointActionFor, overlay: pointingOverlay } = useEventPointing(city)
  const { user } = useAuth()
  const hasPremium = Boolean(user?.entitled)

  async function refresh() {
    await pullSkyEvents()
    const lookaheadDays = hasPremium ? PREMIUM_EVENT_LOOKAHEAD_DAYS : FREE_EVENT_LOOKAHEAD_DAYS
    const [upcoming, watched] = await Promise.all([getUpcomingEvents(lookaheadDays), getWatchlist()])
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
  }, [city, hasPremium])

  function advisoryFor(event: SkyEvent): DailyViewingAdvisory | null {
    return advisory.find((day) => day.date === event.startsAt.slice(0, 10)) ?? null
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
      lat: city.lat,
      lon: city.lon,
      cloudCoverPct: advisoryFor(event)?.cloudCoverPct,
      precipitationChancePct: advisoryFor(event)?.precipitationChancePct,
    })
    setReminders(listGetReadyReminders())
    setStatus(hasPermission ? 'Reminder armed.' : 'Saved in Atlas. Browser notifications are not enabled.')
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
          {events ? events.length : 0} UPCOMING &middot; NEXT {hasPremium ? PREMIUM_EVENT_LOOKAHEAD_DAYS : FREE_EVENT_LOOKAHEAD_DAYS} DAYS &middot; MOON{' '}
          {moonPct}%
        </div>
      </div>
      {status && <p className="planner-reminder-status">{status}</p>}
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

import { useEffect, useState } from 'react'
import '../pages/dt-shared.css'
import { SkyEventBrowser } from '../components/mobile/SkyEventBrowser'
import { EntryDetailView, type EntryDetailActions, type QuickActionOutcome } from '../views/mobile/EntryDetailView'
import { CAMERA_PROFILES, getDefaultDevice } from '../lib/cameraProfiles'
import { isLocalEvent } from '../lib/eventFilters'
import { addGetReadyReminder, ensureNotificationPermission, listGetReadyReminders } from '../lib/getReadyReminders'
import { getEventsInRange, pullSkyEvents } from '../lib/sync'
import { addToWatchlist, getWatchlist, isWatching, removeFromWatchlist, type WatchlistItem } from '../lib/watchlist'
import { trackEvent } from '../lib/analytics'
import { useAuth } from '../lib/auth'
import { buildDailySkyGuideEvents, SKY_GUIDE_WINDOW_DAYS } from '../lib/visiblePlanets'
import { buildEventDetail, detailInputFromEvent, type EntryDetailSubject } from '../lib/entryDetail'
import { getDarknessWindow } from '../lib/darknessWindow'
import { tonightWindowForTimeZone } from '../lib/timeZone'
import { eventLookaheadDays } from '../lib/entitlementLimits'
import { localDateKey } from '../lib/weather'
import { useMobileDetailNav } from '../lib/mobileDetailNav'
import type { CurrentLocation } from '../lib/currentLocation'
import type { ObservationDraft } from '../lib/observationDraft'
import type { SkyEvent } from '../lib/db'

export interface SearchPageProps {
  city: CurrentLocation
  onLogAttempt: (draft: ObservationDraft) => void
}

// A dedicated search entry point, reachable from the bottom nav on every
// screen -- Events' own search field only ever surfaces once you've
// scrolled past Today/Notifications/etc, which buries it (KES-fix for the
// giant-icon dt-search-row bug also lives in dt-shared.css).
export function SearchPage({ city, onLogAttempt }: SearchPageProps) {
  const [events, setEvents] = useState<SkyEvent[] | null>(null)
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [reminders, setReminders] = useState(() => listGetReadyReminders())
  const [entryDetail, setEntryDetail] = useState<{ subject: EntryDetailSubject; actions: EntryDetailActions } | null>(null)
  const { user } = useAuth()
  const hasPremium = Boolean(user?.entitled)
  const lookaheadDays = eventLookaheadDays(hasPremium)
  const { setActive: setMobileDetailActive } = useMobileDetailNav()

  useEffect(() => {
    setMobileDetailActive(entryDetail !== null)
    return () => setMobileDetailActive(false)
  }, [entryDetail, setMobileDetailActive])

  useEffect(() => {
    let cancelled = false
    async function load() {
      await pullSkyEvents()
      const now = new Date()
      const lookaheadEnd = new Date(now.getTime() + lookaheadDays * 86_400_000)
      const [upcoming, watched] = await Promise.all([getEventsInRange(now, lookaheadEnd), getWatchlist()])
      if (cancelled) return
      const localUpcoming = upcoming.filter((event) => isLocalEvent(event, city.lat, city.lon))
      const daysWithEvents = new Set(localUpcoming.map((event) => localDateKey(event.startsAt, city.timeZone)))
      const guides = buildDailySkyGuideEvents(new Date(), Math.min(lookaheadDays, SKY_GUIDE_WINDOW_DAYS), city.lat, city.lon).filter(
        (guide) => !daysWithEvents.has(localDateKey(guide.startsAt, city.timeZone)),
      )
      setEvents([...guides, ...localUpcoming])
      setWatchlist(watched)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [city.lat, city.lon, city.timeZone, lookaheadDays])

  async function toggleWatch(event: SkyEvent): Promise<QuickActionOutcome> {
    if (!hasPremium) {
      trackEvent('Blocked free plan add', { action: 'watch', source: 'mobile_search' })
      return { watching: false, message: 'Sky Pass is required to add events to a plan. Browsing and check-ins stay free.' }
    }
    const nowWatching = !isWatching(watchlist, 'target', event.target)
    if (nowWatching) await addToWatchlist('target', event.target)
    else await removeFromWatchlist('target', event.target)
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
      lat: city.lat,
      lon: city.lon,
    })
    setReminders(listGetReadyReminders())
    const message = hasPermission ? 'Reminder armed.' : 'Saved in Atlas. Browser notifications are not enabled.'
    trackEvent('Added get ready reminder', { target: event.title, hasPermission, source: 'mobile_search' })
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
    const reminder = reminders.find((candidate) => candidate.eventId === event.id)
    setEntryDetail({
      subject,
      actions: {
        watching: isWatching(watchlist, 'target', event.target),
        onToggleWatch: () => toggleWatch(event),
        reminderActive: !!reminder,
        onRemind: () => addReminder(event),
      },
    })
  }

  return (
    <div className="page">
      <h1 className="sr-only">Search</h1>
      <div className="mobile-shell">
        <SkyEventBrowser events={events} onSelect={selectEvent} timeZone={city.timeZone} autoFocusSearch />
      </div>

      {entryDetail && (
        <div className="mobile-shell dt-entry-overlay">
          <EntryDetailView
            subject={entryDetail.subject}
            actions={entryDetail.actions}
            onClose={() => setEntryDetail(null)}
            onLogAttempt={logEntryDetailAttempt}
          />
        </div>
      )}
    </div>
  )
}

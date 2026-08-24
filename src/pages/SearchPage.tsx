import { useEffect, useMemo, useState } from 'react'
import '../pages/dt-shared.css'
import { SkyEventBrowser } from '../components/mobile/SkyEventBrowser'
import { EntryDetailView, type EntryDetailActions, type QuickActionOutcome } from '../views/mobile/EntryDetailView'
import { CAMERA_PROFILES, getDefaultDevice } from '../lib/cameraProfiles'
import { isVisibleLocalEvent } from '../lib/eventFilters'
import { addGetReadyReminder, ensureNotificationPermission, listGetReadyReminders } from '../lib/getReadyReminders'
import { getEventsInRange, pullSkyEvents } from '../lib/sync'
import { addToWatchlist, getWatchlist, isWatching, removeFromWatchlist, type WatchlistItem } from '../lib/watchlist'
import { getTaggedEventIds, toggleEventTag } from '../lib/eventTags'
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
import { ensurePushSubscription, queueWatchConfirmation } from '../lib/push'
import { CITIES, cityLabel, type City } from '../lib/cities'
import { diversifyEvents } from '../lib/eventFilters'

export interface SearchPageProps {
  city: CurrentLocation
  onLogAttempt: (draft: ObservationDraft) => void
}

export function SearchPage({ city, onLogAttempt }: SearchPageProps) {
  const [events, setEvents] = useState<SkyEvent[] | null>(null)
  const [allEvents, setAllEvents] = useState<SkyEvent[] | null>(null)
  const [activeTab, setActiveTab] = useState<'events' | 'standout'>('events')
  const [exploreCity, setExploreCity] = useState<City>(() => CITIES.find((candidate) => candidate.name === city.name) ?? { name: city.name, lat: city.lat, lon: city.lon, timeZone: city.timeZone })
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [taggedIds, setTaggedIds] = useState<Set<string>>(new Set())
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
      const [upcoming, watched, tagged] = await Promise.all([getEventsInRange(now, lookaheadEnd), getWatchlist(), getTaggedEventIds()])
      if (cancelled) return
      setAllEvents(upcoming)
      const localUpcoming = upcoming.filter((event) => isVisibleLocalEvent(event, city.lat, city.lon))
      const daysWithEvents = new Set(localUpcoming.map((event) => localDateKey(event.startsAt, city.timeZone)))
      const guides = buildDailySkyGuideEvents(new Date(), Math.min(lookaheadDays, SKY_GUIDE_WINDOW_DAYS), city.lat, city.lon).filter(
        (guide) => !daysWithEvents.has(localDateKey(guide.startsAt, city.timeZone)),
      )
      setEvents([...guides, ...localUpcoming])
      setWatchlist(watched)
      setTaggedIds(tagged)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [city.lat, city.lon, city.timeZone, lookaheadDays])

  const exploreLocation: CurrentLocation = {
    name: cityLabel(exploreCity),
    lat: exploreCity.lat,
    lon: exploreCity.lon,
    source: 'manual',
    timeZone: exploreCity.timeZone ?? city.timeZone,
  }
  const standoutEvents = useMemo(() => {
    if (!allEvents) return null
    const local = allEvents.filter((event) => isVisibleLocalEvent(event, exploreLocation.lat, exploreLocation.lon))
    const guides = buildDailySkyGuideEvents(new Date(), Math.min(lookaheadDays, SKY_GUIDE_WINDOW_DAYS), exploreLocation.lat, exploreLocation.lon)
    return diversifyEvents([...guides, ...local], 10)
  }, [allEvents, exploreLocation.lat, exploreLocation.lon, lookaheadDays])

  useEffect(() => {
    function refreshTags() {
      getTaggedEventIds().then(setTaggedIds)
    }
    window.addEventListener('atlas:tagged-events-changed', refreshTags)
    return () => window.removeEventListener('atlas:tagged-events-changed', refreshTags)
  }, [])

  async function toggleWatch(event: SkyEvent): Promise<QuickActionOutcome> {
    if (!hasPremium) {
      trackEvent('Blocked free plan add', { action: 'watch', source: 'mobile_search' })
      return { watching: false, message: 'Sky Pass is required to add events to a plan. Browsing and check-ins stay free.' }
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
            : 'Watching saved, but push is not enabled. Enable it in Settings to receive notifications.'
      } catch {
        pushMessage = 'Watching saved, but push setup needs attention in Settings.'
      }
      setWatchlist(await getWatchlist())
      return { watching: nowWatching, message: pushMessage }
    }
    await removeFromWatchlist('target', event.target)
    setWatchlist(await getWatchlist())
    return { watching: nowWatching, message: nowWatching ? 'Added to your watchlist.' : 'Removed from your watchlist.' }
  }

  // Tagging is free (unlike watch/remind, which are Sky Pass-gated) -- it's
  // just a per-event bookmark for the feed's "Tagged only" filter. Tagging
  // on also arms a get-ready reminder (best-effort; reminders themselves
  // don't require Sky Pass either), so "bookmark" and "get notified" are one
  // action instead of two. Mirrors EventsView.tsx's toggleTag.
  async function toggleTag(event: SkyEvent): Promise<QuickActionOutcome> {
    const nowTagged = !taggedIds.has(event.id)
    await toggleEventTag(event.id, !nowTagged)
    if (nowTagged) await addReminder(event)
    setTaggedIds(await getTaggedEventIds())
    return { tagged: nowTagged, message: nowTagged ? 'Tagged -- added to your feed filter and armed a reminder.' : 'Untagged.' }
  }

  async function addReminder(event: SkyEvent, location: CurrentLocation = city): Promise<QuickActionOutcome> {
    const hasPermission = await ensureNotificationPermission()
    await addGetReadyReminder({
      eventId: event.id,
      title: event.title,
      kind: event.kind,
      target: event.target,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      deviceName: CAMERA_PROFILES[getDefaultDevice()].name,
      lat: location.lat,
      lon: location.lon,
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

  function selectEvent(event: SkyEvent, location: CurrentLocation = city) {
    const { start, end } = tonightWindowForTimeZone(new Date(event.startsAt), location.timeZone)
    const darknessWindow = getDarknessWindow(location.lat, location.lon, start, end)
    const subject = buildEventDetail(detailInputFromEvent(event, location, darknessWindow), null)
    const reminder = reminders.find((candidate) => candidate.eventId === event.id)
    setEntryDetail({
      subject,
      actions: {
        watching: isWatching(watchlist, 'target', event.target),
        onToggleWatch: () => toggleWatch(event),
        reminderActive: !!reminder,
        onRemind: () => addReminder(event, location),
        tagged: taggedIds.has(event.id),
        onToggleTag: () => toggleTag(event),
      },
    })
  }

  return (
    <div className="page">
      <h1 className="sr-only">Explore</h1>
      <div className="mobile-shell">
        <div className="explore-tabs" role="tablist" aria-label="Explore sections">
          <button type="button" role="tab" aria-selected={activeTab === 'events'} className={activeTab === 'events' ? 'is-active' : ''} onClick={() => setActiveTab('events')}>Find events</button>
          <button type="button" role="tab" aria-selected={activeTab === 'standout'} className={activeTab === 'standout' ? 'is-active' : ''} onClick={() => setActiveTab('standout')}>Standout in a city</button>
        </div>
        {activeTab === 'events' ? (
          <SkyEventBrowser events={events} onSelect={selectEvent} timeZone={city.timeZone} autoFocusSearch />
        ) : (
          <section className="explore-standout" aria-label="Standout events in a city">
            <div className="dt-feed-heading">
              <span className="dt-kicker">Standout events</span>
              <p>See what is genuinely observable from another city.</p>
            </div>
            <label className="explore-city-picker">
              <span>City</span>
              <select value={exploreCity.name} onChange={(event) => {
                const next = CITIES.find((candidate) => candidate.name === event.currentTarget.value)
                if (next) setExploreCity(next)
              }}>
                {CITIES.map((candidate) => <option key={candidate.name} value={candidate.name}>{cityLabel(candidate)}</option>)}
              </select>
            </label>
            <SkyEventBrowser events={standoutEvents} onSelect={(event) => selectEvent(event, exploreLocation)} timeZone={exploreLocation.timeZone} />
          </section>
        )}
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

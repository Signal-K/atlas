import { useEffect, useMemo, useState } from 'react'
import { registerWidget } from './registry'
import { EventRow } from './EventRow'
import { getUpcomingEvents, pullSkyEvents } from '../lib/sync'
import { getPinnedEventIds, togglePin } from '../lib/pins'
import { getWatchCountForEvent, getWatchCounts, getWatchlist, matchesWatchlist, type WatchlistItem } from '../lib/watchlist'
import { useLocationBrowse } from '../lib/locationBrowseContext'
import type { SkyEvent } from '../lib/db'

type FilterTab = 'today' | 'week' | 'pinned' | 'watching' | 'all'

const TABS: Array<{ id: FilterTab; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'pinned', label: 'Pinned' },
  { id: 'watching', label: 'Watching' },
  { id: 'all', label: 'All' },
]

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function UpcomingEventsWidget() {
  const { city } = useLocationBrowse()
  const [events, setEvents] = useState<SkyEvent[] | null>(null)
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set())
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [watchCounts, setWatchCounts] = useState<Map<string, number>>(new Map())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tab, setTab] = useState<FilterTab>('all')

  async function refreshPins() {
    setPinnedIds(await getPinnedEventIds())
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      await pullSkyEvents()
      // Location-specific events (ISS passes) across ~16 cities add up fast,
      // so fetch generously rather than the old flat 8 -- filtering down to
      // the selected city and active tab happens below.
      const upcoming = await getUpcomingEvents(400)
      if (!cancelled) setEvents(upcoming)
      if (!cancelled) setWatchlist(await getWatchlist())
      if (!cancelled) setWatchCounts(await getWatchCounts())
    }

    load()
    refreshPins()
    window.addEventListener('online', load)
    return () => {
      cancelled = true
      window.removeEventListener('online', load)
    }
  }, [])

  const forLocation = useMemo(() => {
    if (!events) return []
    return events.filter((event) => {
      if (event.latitude == null || event.longitude == null) return true
      return Math.abs(event.latitude - city.lat) < 0.01 && Math.abs(event.longitude - city.lon) < 0.01
    })
  }, [events, city])

  const filtered = useMemo(() => {
    const now = new Date()
    switch (tab) {
      case 'today':
        return forLocation.filter((event) => isSameDay(new Date(event.startsAt), now))
      case 'week': {
        const weekEnd = new Date(now.getTime() + 7 * 86_400_000)
        return forLocation.filter((event) => new Date(event.startsAt) <= weekEnd)
      }
      case 'pinned':
        return forLocation.filter((event) => pinnedIds.has(event.id))
      case 'watching':
        return forLocation.filter((event) => matchesWatchlist(event, watchlist))
      case 'all':
      default:
        return forLocation
    }
  }, [forLocation, tab, pinnedIds, watchlist])

  async function handleTogglePin(eventId: string) {
    await togglePin(eventId, pinnedIds.has(eventId))
    await refreshPins()
  }

  if (events === null) {
    return <p>Loading&hellip;</p>
  }

  return (
    <div>
      <div className="filter-tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? 'is-active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p>
          {events.length === 0
            ? 'No upcoming events cached yet. Connect once online to sync.'
            : 'Nothing in this view yet.'}
        </p>
      ) : (
        <ul className="row-list">
          {filtered.slice(0, 8).map((event) => (
            <EventRow
              key={event.id}
              event={event}
              expanded={expandedId === event.id}
              onToggle={() => setExpandedId((current) => (current === event.id ? null : event.id))}
              pinned={pinnedIds.has(event.id)}
              onTogglePin={() => handleTogglePin(event.id)}
              watching={matchesWatchlist(event, watchlist)}
              watchCount={getWatchCountForEvent(event, watchCounts)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

registerWidget({
  id: 'upcoming-events',
  title: 'Upcoming sky events',
  Component: UpcomingEventsWidget,
  defaultEnabled: true,
})

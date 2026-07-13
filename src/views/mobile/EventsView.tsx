import { useEffect, useState } from 'react'
import { EventRow } from '../../widgets/EventRow'
import { getUpcomingEvents, pullSkyEvents } from '../../lib/sync'
import { getWatchCountForEvent, getWatchCounts, getWatchlist, matchesWatchlist, type WatchlistItem } from '../../lib/watchlist'
import type { SkyEvent } from '../../lib/db'

export function EventsView() {
  const [events, setEvents] = useState<SkyEvent[] | null>(null)
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [watchCounts, setWatchCounts] = useState<Map<string, number>>(new Map())
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      await pullSkyEvents()
      const upcoming = await getUpcomingEvents(30)
      if (cancelled) return
      setEvents(upcoming)
      setWatchlist(await getWatchlist())
      setWatchCounts(await getWatchCounts())
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="mobile-card mobile-events">
      <div className="mobile-card-eyebrow">Upcoming sky events</div>
      {events === null ? (
        <p className="mobile-empty-hint">Loading&hellip;</p>
      ) : events.length === 0 ? (
        <p className="mobile-empty-hint">No events cached yet — try again once online.</p>
      ) : (
        <ul className="row-list">
          {events.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              expanded={expandedId === event.id}
              onToggle={() => setExpandedId((current) => (current === event.id ? null : event.id))}
              watching={matchesWatchlist(event, watchlist)}
              watchCount={getWatchCountForEvent(event, watchCounts)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

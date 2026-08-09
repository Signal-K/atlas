import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { categoryFor } from '../lib/eventCategories'
import { fetchPastEvents, groupEventsByDay, type AtlasEvent } from '../lib/events'

// How far back the archive looks -- events don't need a Sky Pass gate here,
// but an unbounded query would grow forever as the ingest keeps running.
const ARCHIVE_WINDOW_DAYS = 90

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function EventArchivePage() {
  const [events, setEvents] = useState<AtlasEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchPastEvents(ARCHIVE_WINDOW_DAYS).then((result) => {
      if (!cancelled) {
        setEvents(result)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const dayGroups = groupEventsByDay(events)

  return (
    <div className="page">
      <Link to="/app/events" className="ui-back-link">
        ← Events
      </Link>

      <div className="page-header">
        <h1>Past events</h1>
        <p>Sky events that have already happened, most recent first.</p>
      </div>

      {loading && <p className="ui-empty-state">Loading archive…</p>}

      {!loading && dayGroups.length === 0 && <p className="ui-empty-state">Nothing in the archive yet.</p>}

      {!loading &&
        dayGroups.map((group) => (
          <section key={group.key} className="ui-day-group">
            <h2 className="ui-day-group-label">{group.label}</h2>
            <ul className="ui-list">
              {group.events.map((event) => {
                const category = categoryFor(event.kind)
                return (
                  <li key={event.id} className="ui-list-item">
                    <Link to={`/app/events/${event.id}`} state={{ event }} className="ui-feed-row">
                      <div className="ui-feed-top">
                        <span className="ui-feed-kicker">{category.label}</span>
                        <span className="ui-feed-time">{formatTime(event.starts_at)}</span>
                      </div>
                      <span className="ui-feed-headline">{event.title}</span>
                      {event.description && <span className="ui-feed-description">{event.description}</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
    </div>
  )
}

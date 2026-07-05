import { useEffect, useState } from 'react'
import { registerWidget } from './registry'
import { getUpcomingEvents, pullSkyEvents } from '../lib/sync'
import type { SkyEvent } from '../lib/db'

function EventRow({ event, expanded, onToggle }: { event: SkyEvent; expanded: boolean; onToggle: () => void }) {
  return (
    <li>
      <button type="button" className="row-trigger" onClick={onToggle} aria-expanded={expanded}>
        <span className="row-marker" />
        <span className="row-text">{event.title}</span>
        <span className="row-meta">
          {new Date(event.startsAt).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </span>
      </button>
      {expanded && (
        <div className="row-detail">
          {event.imageUrl && (
            <figure className="row-detail-image">
              <img src={event.imageUrl} alt={event.title} loading="lazy" />
              {event.imageCredit && <figcaption>{event.imageCredit}</figcaption>}
            </figure>
          )}
          <p>{event.content ?? event.description}</p>
        </div>
      )}
    </li>
  )
}

function UpcomingEventsWidget() {
  const [events, setEvents] = useState<SkyEvent[] | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      await pullSkyEvents()
      const upcoming = await getUpcomingEvents(8)
      if (!cancelled) setEvents(upcoming)
    }

    load()
    window.addEventListener('online', load)
    return () => {
      cancelled = true
      window.removeEventListener('online', load)
    }
  }, [])

  if (events === null) {
    return <p>Loading&hellip;</p>
  }

  if (events.length === 0) {
    return <p>No upcoming events cached yet. Connect once online to sync.</p>
  }

  return (
    <ul className="row-list">
      {events.map((event) => (
        <EventRow
          key={event.id}
          event={event}
          expanded={expandedId === event.id}
          onToggle={() => setExpandedId((current) => (current === event.id ? null : event.id))}
        />
      ))}
    </ul>
  )
}

registerWidget({
  id: 'upcoming-events',
  title: 'Upcoming sky events',
  Component: UpcomingEventsWidget,
  defaultEnabled: true,
})

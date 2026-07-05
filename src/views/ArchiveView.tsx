import { useEffect, useState } from 'react'
import { EventRow } from '../widgets/EventRow'
import { getPastEvents } from '../lib/sync'
import type { SkyEvent } from '../lib/db'

export function ArchiveView() {
  const [events, setEvents] = useState<SkyEvent[] | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getPastEvents(30).then((past) => {
      if (!cancelled) setEvents(past)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="widget-section">
      <h2>Archive</h2>
      {events === null && <p>Loading&hellip;</p>}
      {events !== null && events.length === 0 && (
        <p>No past events yet — events move here once they&apos;ve happened.</p>
      )}
      {events !== null && events.length > 0 && (
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
      )}
    </section>
  )
}

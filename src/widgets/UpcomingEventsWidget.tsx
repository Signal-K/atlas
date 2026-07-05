import { useEffect, useState } from 'react'
import { registerWidget } from './registry'
import { getUpcomingEvents, pullSkyEvents } from '../lib/sync'
import type { SkyEvent } from '../lib/db'

function UpcomingEventsWidget() {
  const [events, setEvents] = useState<SkyEvent[] | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      await pullSkyEvents()
      const upcoming = await getUpcomingEvents(5)
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
        <li key={event.id}>
          <span className="row-marker" />
          <span className="row-text">{event.title}</span>
          <span className="row-meta">
            {new Date(event.startsAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </span>
        </li>
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

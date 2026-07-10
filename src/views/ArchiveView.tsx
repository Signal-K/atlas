import { useEffect, useMemo, useState } from 'react'
import { KIND_LABELS } from '../widgets/EventRow'
import { getPastEvents } from '../lib/sync'
import type { SkyEvent } from '../lib/db'

interface DayGroup {
  dateKey: string
  events: SkyEvent[]
}

function dateKey(event: SkyEvent): string {
  return event.startsAt.slice(0, 10)
}

function groupByDay(events: SkyEvent[]): DayGroup[] {
  const groups: DayGroup[] = []
  for (const event of events) {
    const key = dateKey(event)
    const last = groups[groups.length - 1]
    if (last && last.dateKey === key) last.events.push(event)
    else groups.push({ dateKey: key, events: [event] })
  }
  return groups
}

function ArchiveEntry({ event }: { event: SkyEvent }) {
  return (
    <article className="archive-entry">
      {event.imageUrl && <img className="archive-entry-image" src={event.imageUrl} alt={event.title} loading="lazy" />}
      <div className="archive-entry-body">
        <span className="archive-entry-kind">{KIND_LABELS[event.kind] ?? event.kind}</span>
        <h4 className="archive-entry-title">{event.title}</h4>
        <p className="archive-entry-desc">{event.description}</p>
        <span className="archive-entry-time">
          {new Date(event.startsAt).toLocaleTimeString(undefined, { timeStyle: 'short' })}
        </span>
      </div>
    </article>
  )
}

export function ArchiveView() {
  const [events, setEvents] = useState<SkyEvent[] | null>(null)

  useEffect(() => {
    let cancelled = false
    getPastEvents(30).then((past) => {
      if (!cancelled) setEvents(past)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const groups = useMemo(() => groupByDay(events ?? []), [events])

  return (
    <section className="widget-section archive-section">
      <h2>Archive</h2>
      {events === null && <p>Loading&hellip;</p>}
      {events !== null && events.length === 0 && (
        <p>No past events yet — events move here once they&apos;ve happened.</p>
      )}
      {groups.map((group) => {
        const date = new Date(group.dateKey)
        return (
          <div key={group.dateKey} className="archive-day-group">
            <div className="archive-day-stamp">
              <span className="archive-day-number">{date.getDate()}</span>
              <span className="archive-day-meta">
                {date.toLocaleDateString(undefined, { weekday: 'short' })}
                <br />
                {date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
              </span>
            </div>
            <div className="archive-day-entries">
              {group.events.map((event) => (
                <ArchiveEntry key={event.id} event={event} />
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}

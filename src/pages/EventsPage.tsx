import { useEffect, useMemo, useState } from 'react'
import { categoryFor, CATEGORY_GROUPS } from '../lib/eventCategories'
import { fetchUpcomingEvents, groupEventsByDay, type AtlasEvent } from '../lib/events'

// "Coming up" default window vs. the expanded "full list" window -- see the
// Show full list button below.
const COMING_UP_DAYS = 7
const FULL_LIST_DAYS = 45

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function EventsPage() {
  const [events, setEvents] = useState<AtlasEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showFullList, setShowFullList] = useState(false)
  const [activeGroup, setActiveGroup] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchUpcomingEvents(showFullList ? FULL_LIST_DAYS : COMING_UP_DAYS).then((result) => {
      if (!cancelled) {
        setEvents(result)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [showFullList])

  const presentGroups = useMemo(() => {
    const present = new Set(events.map((event) => categoryFor(event.kind).group))
    return CATEGORY_GROUPS.filter((group) => present.has(group))
  }, [events])

  const filteredEvents = useMemo(() => {
    if (!activeGroup) return events
    return events.filter((event) => categoryFor(event.kind).group === activeGroup)
  }, [events, activeGroup])

  const dayGroups = useMemo(() => groupEventsByDay(filteredEvents), [filteredEvents])

  return (
    <div className="page">
      <div className="page-header">
        <h1>Events</h1>
        <p>What's coming up in the sky, grouped by day.</p>
      </div>

      {presentGroups.length > 0 && (
        <div className="ui-chip-row" role="group" aria-label="Filter by category">
          <button type="button" className={`ui-chip${activeGroup === null ? ' ui-chip-active' : ''}`} onClick={() => setActiveGroup(null)}>
            All
          </button>
          {presentGroups.map((group) => (
            <button
              key={group}
              type="button"
              className={`ui-chip${activeGroup === group ? ' ui-chip-active' : ''}`}
              onClick={() => setActiveGroup(group)}
            >
              {group}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="ui-empty-state">Loading events…</p>}

      {!loading && dayGroups.length === 0 && <p className="ui-empty-state">No events in this window yet.</p>}

      {!loading &&
        dayGroups.map((group) => (
          <section key={group.key} className="ui-day-group">
            <h2 className="ui-day-group-label">{group.label}</h2>
            <ul className="ui-list">
              {group.events.map((event) => {
                const category = categoryFor(event.kind)
                return (
                  <li key={event.id} className="ui-list-item">
                    <div className="ui-feed-row">
                      <div className="ui-feed-top">
                        <span className="ui-feed-kicker">{category.label}</span>
                        <span className="ui-feed-time">{formatTime(event.starts_at)}</span>
                      </div>
                      <span className="ui-feed-headline">{event.title}</span>
                      {event.description && <span className="ui-feed-description">{event.description}</span>}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}

      {!loading && !showFullList && (
        <button type="button" className="ui-button" onClick={() => setShowFullList(true)}>
          Show full list
        </button>
      )}
    </div>
  )
}

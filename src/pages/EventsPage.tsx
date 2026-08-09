import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { categoryFor, CATEGORY_GROUPS } from '../lib/eventCategories'
import { fetchUpcomingEvents, groupEventsByDay, type AtlasEvent } from '../lib/events'
import { eventLookaheadDays } from '../lib/entitlementLimits'

// "Coming up" default window vs. the expanded "full list" window -- capped
// at the caller's lookahead (see entitlementLimits.ts): free accounts don't
// get a "Show full list" that outruns their own 10-day window.
const COMING_UP_DAYS = 7
// Days flooded with minor events (e.g. multiple ISS passes) would otherwise
// push a single day's list past the fold -- cap it and let the day itself
// expand on request.
const MAX_EVENTS_PER_DAY = 5

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export interface EventsPageProps {
  entitled: boolean
}

export function EventsPage({ entitled }: EventsPageProps) {
  const [events, setEvents] = useState<AtlasEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showFullList, setShowFullList] = useState(false)
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())

  const fullListDays = eventLookaheadDays(entitled)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchUpcomingEvents(showFullList ? fullListDays : Math.min(COMING_UP_DAYS, fullListDays)).then((result) => {
      if (!cancelled) {
        setEvents(result)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [showFullList, fullListDays])

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
        <Link to="/app/events/archive" className="ui-back-link">
          View past events
        </Link>
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
        dayGroups.map((group) => {
          const dayExpanded = expandedDays.has(group.key)
          const visibleEvents = dayExpanded ? group.events : group.events.slice(0, MAX_EVENTS_PER_DAY)
          const hiddenCount = group.events.length - visibleEvents.length
          return (
            <section key={group.key} className="ui-day-group">
              <h2 className="ui-day-group-label">{group.label}</h2>
              <ul className="ui-list">
                {visibleEvents.map((event) => {
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
              {hiddenCount > 0 && (
                <button
                  type="button"
                  className="ui-button ui-button-ghost"
                  onClick={() => setExpandedDays((current) => new Set(current).add(group.key))}
                >
                  Show {hiddenCount} more
                </button>
              )}
            </section>
          )
        })}

      {!loading && !showFullList && (
        <button type="button" className="ui-button" onClick={() => setShowFullList(true)}>
          Show full list
        </button>
      )}
    </div>
  )
}

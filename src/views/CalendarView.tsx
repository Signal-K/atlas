import { useEffect, useMemo, useState } from 'react'
import { EventRow } from '../widgets/EventRow'
import { getEventsInRange, pullSkyEvents } from '../lib/sync'
import { getWatchCountForEvent, getWatchCounts, getWatchlist, matchesWatchlist, type WatchlistItem } from '../lib/watchlist'
import { EVENT_CATEGORIES } from '../lib/eventCategories'
import { DailyTransitArticles } from '../components/DailyTransitArticles'
import { useAuth } from '../lib/auth'
import { eventLookaheadDays } from '../lib/entitlementLimits'
import type { SkyEvent } from '../lib/db'

const ALL_CATEGORY_ID = 'all'

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

// Plain-language grouping for the "Coming up" list -- addresses the notes'
// call for the events page to be "100% clear... how they can see it, and
// when" instead of only surfacing timing once a specific day is clicked.
function relativeDayLabel(date: Date, today: Date): string {
  const dayDiff = Math.round((startOfDay(date).getTime() - startOfDay(today).getTime()) / 86_400_000)
  if (dayDiff === 0) return 'Today'
  if (dayDiff === 1) return 'Tomorrow'
  if (dayDiff > 1 && dayDiff < 7) return 'This week'
  return 'Later'
}

function groupUpcoming(events: SkyEvent[], today: Date): Array<{ label: string; events: SkyEvent[] }> {
  const order = ['Today', 'Tomorrow', 'This week', 'Later']
  const buckets = new Map<string, SkyEvent[]>()
  for (const event of events) {
    const label = relativeDayLabel(new Date(event.startsAt), today)
    const list = buckets.get(label) ?? []
    list.push(event)
    buckets.set(label, list)
  }
  return order.filter((label) => buckets.has(label)).map((label) => ({ label, events: buckets.get(label)! }))
}

export function CalendarView() {
  const { user } = useAuth()
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()))
  const [events, setEvents] = useState<SkyEvent[] | null>(null)
  const [upcomingEvents, setUpcomingEvents] = useState<SkyEvent[] | null>(null)
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [watchCounts, setWatchCounts] = useState<Map<string, number>>(new Map())
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<string>(ALL_CATEGORY_ID)
  const lookaheadDays = eventLookaheadDays(Boolean(user?.entitled))

  useEffect(() => {
    let cancelled = false
    async function load() {
      await pullSkyEvents()
      const rangeStart = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1)
      const rangeEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1)
      const monthEvents = await getEventsInRange(rangeStart, rangeEnd)
      if (!cancelled) setEvents(monthEvents)
      if (!cancelled) setWatchlist(await getWatchlist())
      if (!cancelled) setWatchCounts(await getWatchCounts())
    }
    load()
    return () => {
      cancelled = true
    }
  }, [monthStart])

  useEffect(() => {
    let cancelled = false
    async function load() {
      await pullSkyEvents()
      const start = new Date()
      const end = new Date(start.getTime() + Math.min(lookaheadDays, 14) * 86_400_000)
      const upcoming = await getEventsInRange(start, end)
      if (!cancelled) setUpcomingEvents(upcoming)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [lookaheadDays])

  const weeks = useMemo(() => {
    const firstDayOfWeek = monthStart.getDay()
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate()
    const cells: Array<Date | null> = [...Array(firstDayOfWeek).fill(null)]
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), day))
    }
    while (cells.length % 7 !== 0) cells.push(null)
    const rows: Array<Array<Date | null>> = []
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
    return rows
  }, [monthStart])

  const activeCategory = useMemo(() => EVENT_CATEGORIES.find((c) => c.id === categoryId), [categoryId])

  const filteredEvents = useMemo(() => {
    if (!activeCategory) return events ?? []
    return (events ?? []).filter((event) => activeCategory.kinds.includes(event.kind))
  }, [events, activeCategory])

  const filteredUpcoming = useMemo(() => {
    if (!activeCategory) return upcomingEvents ?? []
    return (upcomingEvents ?? []).filter((event) => activeCategory.kinds.includes(event.kind))
  }, [upcomingEvents, activeCategory])

  const upcomingGroups = useMemo(() => groupUpcoming(filteredUpcoming, new Date()), [filteredUpcoming])

  const eventsByDay = useMemo(() => {
    const map = new Map<number, SkyEvent[]>()
    for (const event of filteredEvents) {
      const day = new Date(event.startsAt).getDate()
      const list = map.get(day) ?? []
      list.push(event)
      map.set(day, list)
    }
    return map
  }, [filteredEvents])

  const selectedDayEvents = useMemo(
    () => filteredEvents.filter((event) => isSameDay(new Date(event.startsAt), selectedDay)),
    [filteredEvents, selectedDay],
  )

  return (
    <section className="widget-section">
      <h2 className="dt-panel-heading">The Daily Transit</h2>
      <p className="scrapbook-hint">The latest from thedailytransit.com — Signal-K's citizen-science news site.</p>
      <DailyTransitArticles />

      <div className="calendar-category-filter">
        <button
          type="button"
          className={`calendar-category-chip${categoryId === ALL_CATEGORY_ID ? ' is-active' : ''}`}
          onClick={() => setCategoryId(ALL_CATEGORY_ID)}
        >
          All
        </button>
        {EVENT_CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            className={`calendar-category-chip${categoryId === category.id ? ' is-active' : ''}`}
            onClick={() => setCategoryId(category.id)}
            style={categoryId === category.id ? { borderColor: category.accent, color: category.accent } : undefined}
          >
            {category.label}
          </button>
        ))}
      </div>

      <h2 className="calendar-coming-up-heading">Coming up</h2>
      {upcomingEvents === null ? (
        <p>Loading&hellip;</p>
      ) : upcomingGroups.length === 0 ? (
        <p className="scrapbook-hint">Nothing in the next {Math.min(lookaheadDays, 14)} days for this filter.</p>
      ) : (
        <div className="calendar-upcoming-groups">
          {upcomingGroups.map((group) => (
            <div className="calendar-upcoming-group" key={group.label}>
              <h3 className="calendar-upcoming-group-heading">{group.label}</h3>
              <ul className="row-list">
                {group.events.map((event) => (
                  <EventRow
                    key={`upcoming-${event.id}`}
                    event={event}
                    expanded={expandedId === event.id}
                    onToggle={() => setExpandedId((current) => (current === event.id ? null : event.id))}
                    watching={matchesWatchlist(event, watchlist)}
                    watchCount={getWatchCountForEvent(event, watchCounts)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <h2 className="calendar-browse-heading">Browse by month</h2>
      {events === null ? (
        <p>Loading&hellip;</p>
      ) : (
        <>
          <div className="calendar-header">
            <button type="button" onClick={() => setMonthStart((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>
              &larr;
            </button>
            <h3>{monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
            <button type="button" onClick={() => setMonthStart((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>
              &rarr;
            </button>
          </div>
          <table className="calendar-grid">
            <thead>
              <tr>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, i) => (
                  <th key={i}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((row, i) => (
                <tr key={i}>
                  {row.map((day, j) => {
                    const dayEvents = day ? (eventsByDay.get(day.getDate()) ?? []) : []
                    const hasWatched = dayEvents.some((event) => matchesWatchlist(event, watchlist))
                    return (
                      <td key={j}>
                        {day && (
                          <button
                            type="button"
                            className={`calendar-day${isSameDay(day, selectedDay) ? ' is-selected' : ''}${isSameDay(day, new Date()) ? ' is-today' : ''}`}
                            onClick={() => setSelectedDay(day)}
                          >
                            <span>{day.getDate()}</span>
                            {dayEvents.length > 0 && <span className={`calendar-dot${hasWatched ? ' is-watched' : ''}`} />}
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="calendar-selected-heading">{selectedDay.toLocaleDateString(undefined, { dateStyle: 'full' })}</h3>
          {selectedDayEvents.length === 0 ? (
            <p>Nothing scheduled this day.</p>
          ) : (
            <ul className="row-list">
              {selectedDayEvents.map((event) => (
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
        </>
      )}
    </section>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { EventRow } from '../widgets/EventRow'
import { getEventsInRange, pullSkyEvents } from '../lib/sync'
import { getWatchCountForEvent, getWatchCounts, getWatchlist, matchesWatchlist, type WatchlistItem } from '../lib/watchlist'
import { EVENT_CATEGORIES } from '../lib/eventCategories'
import type { SkyEvent } from '../lib/db'

const ALL_CATEGORY_ID = 'all'

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function CalendarView() {
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()))
  const [events, setEvents] = useState<SkyEvent[] | null>(null)
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [watchCounts, setWatchCounts] = useState<Map<string, number>>(new Map())
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<string>(ALL_CATEGORY_ID)

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

  const filteredEvents = useMemo(() => {
    if (categoryId === ALL_CATEGORY_ID) return events ?? []
    const category = EVENT_CATEGORIES.find((c) => c.id === categoryId)
    if (!category) return events ?? []
    return (events ?? []).filter((event) => category.kinds.includes(event.kind))
  }, [events, categoryId])

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
      <div className="calendar-header">
        <button type="button" onClick={() => setMonthStart((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>
          &larr;
        </button>
        <h2>{monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
        <button type="button" onClick={() => setMonthStart((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>
          &rarr;
        </button>
      </div>

      {events === null ? (
        <p>Loading&hellip;</p>
      ) : (
        <>
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

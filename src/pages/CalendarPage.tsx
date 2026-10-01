import { useEffect, useMemo, useState } from 'react'
import { getEventsInRange, pullSkyEvents } from '../lib/sync'
import { isVisibleLocalEvent } from '../lib/eventFilters'
import { localDateKey } from '../lib/weather'
import { GUIDE_KIND_IDS } from '../lib/eventCategories'
import type { CurrentLocation } from '../lib/currentLocation'
import type { SkyEvent } from '../lib/db'

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function dayLabel(key: string, count: number) {
  const date = new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  return count ? `${date}, ${count} ${count === 1 ? 'event' : 'events'}` : date
}

export function CalendarPage({ city }: { city: CurrentLocation }) {
  const [events, setEvents] = useState<SkyEvent[] | null>(null)
  const [cursor, setCursor] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState(() => localDateKey(new Date().toISOString(), city.timeZone))

  useEffect(() => {
    let cancelled = false
    async function load() {
      await pullSkyEvents()
      const now = new Date()
      const end = new Date(now.getTime() + 365 * 86_400_000)
      const catalogue = (await getEventsInRange(now, end)).filter((event) => isVisibleLocalEvent(event, city.lat, city.lon))
      if (cancelled) return
      setEvents(catalogue.filter((event) => !GUIDE_KIND_IDS.has(event.kind)))
    }
    void load()
    return () => { cancelled = true }
  }, [city.lat, city.lon])

  const calendar = useMemo(() => {
    const today = new Date()
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstWeekday = new Date(year, month, 1).getDay()
    const eventCounts = new Map<string, number>()
    for (const event of events ?? []) {
      const start = new Date(event.startsAt)
      const end = new Date(event.endsAt)
      for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
        const key = localDateKey(day.toISOString(), city.timeZone)
        eventCounts.set(key, (eventCounts.get(key) ?? 0) + 1)
      }
    }
    const todayKey = localDateKey(today.toISOString(), city.timeZone)
    return {
      leadingBlanks: Array.from({ length: firstWeekday }, () => null),
      // The pager controls `cursor`, not `today`. Keeping this label tied to
      // today made a successful next/previous click appear to do nothing.
      monthLabel: cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      days: Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1
        const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        return { day, key, count: eventCounts.get(key) ?? 0, isToday: key === todayKey }
      }),
    }
  }, [cursor, events, city.timeZone])

  const selectedEvents = useMemo(() => (events ?? []).filter((event) => {
    const start = localDateKey(event.startsAt, city.timeZone)
    const end = localDateKey(event.endsAt, city.timeZone)
    return start <= selectedDay && end >= selectedDay
  }), [events, selectedDay, city.timeZone])

  function moveMonth(offset: number) {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  return (
    <div className="az-page">
      <h1 className="az-h1">Calendar</h1>
      <p className="az-hero-title">{city.name} · scheduled events and ongoing phenomena</p>
      <div className="az-calendar" style={{ marginTop: '1rem' }}>
        <div className="az-calendar-head">
          <button type="button" className="az-text-btn" onClick={() => moveMonth(-1)} aria-label="Previous month">←</button>
          <strong>{calendar.monthLabel}</strong>
          <button type="button" className="az-text-btn" onClick={() => moveMonth(1)} aria-label="Next month">→</button>
        </div>
        <div className="az-calendar-weekdays" aria-hidden="true">
          {WEEKDAY_INITIALS.map((label, index) => <span key={index}>{label}</span>)}
        </div>
        <div className="az-calendar-grid" role="group" aria-label={calendar.monthLabel}>
          {calendar.leadingBlanks.map((_, index) => <div key={`blank-${index}`} className="az-calendar-cell is-empty" />)}
          {calendar.days.map((day) => (
            <button type="button" key={day.key} onClick={() => setSelectedDay(day.key)} className={`az-calendar-cell${day.count ? ' has-event' : ''}${day.isToday ? ' is-today' : ''}${selectedDay === day.key ? ' is-selected' : ''}`} aria-pressed={selectedDay === day.key} aria-current={day.isToday ? 'date' : undefined} aria-label={dayLabel(day.key, day.count)}>
              {day.day}
              {day.count > 0 && <span className="az-cal-dot" style={{ background: 'var(--az-violet)' }} />}
            </button>
          ))}
        </div>
        <div className="az-calendar-legend"><span><i style={{ background: 'var(--az-violet)' }} />SCHEDULED EVENT</span></div>
      </div>
      <section className="az-row-group" style={{ marginTop: '1rem' }} aria-live="polite">
        <p className="az-kicker" style={{ margin: '0.75rem 0.875rem 0' }}>{new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        {selectedEvents.length ? selectedEvents.map((event) => <div key={event.id} className="az-row"><span className="az-row-main"><span className="az-row-kind">{event.kind.replaceAll('_', ' ')}</span><span className="az-row-title">{event.title}</span></span></div>) : <p className="az-muted" style={{ padding: '0 0.875rem 0.875rem' }}>No scheduled events. Check Tonight for ordinary-night recommendations.</p>}
      </section>
    </div>
  )
}

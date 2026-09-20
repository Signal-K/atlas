import { useEffect, useMemo, useState } from 'react'
import { getEventsInRange, pullSkyEvents } from '../lib/sync'
import { isVisibleLocalEvent } from '../lib/eventFilters'
import { buildDailyObservingTargets, buildDailySkyGuideEvents, SKY_GUIDE_WINDOW_DAYS } from '../lib/visiblePlanets'
import { localDateKey } from '../lib/weather'
import type { CurrentLocation } from '../lib/currentLocation'
import type { SkyEvent } from '../lib/db'

export function CalendarPage({ city }: { city: CurrentLocation }) {
  const [events, setEvents] = useState<SkyEvent[] | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      await pullSkyEvents()
      const now = new Date()
      const end = new Date(now.getTime() + SKY_GUIDE_WINDOW_DAYS * 86_400_000)
      const catalogue = (await getEventsInRange(now, end)).filter((event) => isVisibleLocalEvent(event, city.lat, city.lon))
      if (cancelled) return
      setEvents([
        ...catalogue,
        ...buildDailySkyGuideEvents(now, SKY_GUIDE_WINDOW_DAYS, city.lat, city.lon),
        ...buildDailyObservingTargets(now, SKY_GUIDE_WINDOW_DAYS, city.lat, city.lon),
      ])
    }
    void load()
    return () => { cancelled = true }
  }, [city.lat, city.lon])

  const calendar = useMemo(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstWeekday = new Date(year, month, 1).getDay()
    const eventDates = new Set((events ?? []).map((event) => localDateKey(event.startsAt, city.timeZone)))
    const todayKey = localDateKey(today.toISOString(), city.timeZone)
    return {
      leadingBlanks: Array.from({ length: firstWeekday }, () => null),
      monthLabel: today.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      days: Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1
        const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        return { day, key, hasEvent: eventDates.has(key), isToday: key === todayKey }
      }),
    }
  }, [events, city.timeZone])

  return (
    <div className="az-page">
      <h1 className="az-h1">Calendar</h1>
      <p className="az-hero-title">{city.name} · nights with something worth seeing</p>
      <div className="az-calendar" style={{ marginTop: '1rem' }}>
        <div className="az-calendar-head"><strong>{calendar.monthLabel}</strong><span className="az-kicker">{events ? `${events.length} TARGETS` : 'LOADING'}</span></div>
        <div className="az-calendar-grid">
          {calendar.leadingBlanks.map((_, index) => <div key={`blank-${index}`} className="az-calendar-cell is-empty" />)}
          {calendar.days.map((day) => (
            <div key={day.key} className={`az-calendar-cell${day.hasEvent ? ' has-event' : ''}${day.isToday ? ' is-today' : ''}`}>
              {day.day}
              {day.hasEvent && !day.isToday && <span className="az-cal-dot" style={{ background: 'var(--az-violet)' }} />}
            </div>
          ))}
        </div>
        <div className="az-calendar-legend"><span><i style={{ background: 'var(--az-violet)' }} />OBSERVING NIGHT</span></div>
      </div>
    </div>
  )
}

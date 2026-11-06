import { useMemo, useState } from 'react'
import { zonedWallTimeToUtc } from '../lib/eventTiming.mjs'
import { buildDailyObservingTargets } from '../lib/visiblePlanets'
import { matchesEquipment, type Equipment } from '../lib/feedEquipment'
import type { CurrentLocation } from '../lib/currentLocation'
import { trackEvent } from '../lib/analytics'

export function DailyFocus({ city, equipment }: { city: CurrentLocation; equipment: Equipment }) {
  const [day, setDay] = useState(0)
  const startKey = new Intl.DateTimeFormat('en-CA', { timeZone: city.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const choices = useMemo(() => {
    const [year, month, date] = startKey.split('-').map(Number)
    const start = city.timeZone ? zonedWallTimeToUtc(year, month, date, 12, 0, city.timeZone) : new Date(`${startKey}T12:00:00Z`)
    const generated = buildDailyObservingTargets(start, 7, city.lat, city.lon, city.timeZone)
    const used = new Set<string>()
    return Array.from({ length: 7 }, (_, offset) => {
      const instant = new Date(start.getTime() + offset * 86400000)
      const key = new Intl.DateTimeFormat('en-CA', { timeZone: city.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant)
      const date = new Date(`${key}T12:00:00Z`)
      const candidates = generated.filter(event => event.id.includes(key) && matchesEquipment(event.kind, equipment))
      const chosen = candidates.find(event => !used.has(event.target)) ?? candidates[0]
      if (chosen) used.add(chosen.target)
      return { date, chosen }
    })
  }, [startKey, city.lat, city.lon, city.timeZone, equipment])
  const current = choices[day]
  return <section className="daily-focus" aria-label="Daily observing focus"><div className="briefing-heading"><h2>One thing to see</h2><span className="data-label">Your daily north star</span></div><div className="daily-picker" role="group" aria-label="Choose observing day">{choices.map((choice, index) => <button type="button" key={choice.date.toISOString()} aria-pressed={day === index} onClick={() => { setDay(index); trackEvent('Daily focus selected', { day_offset: index, equipment, target: choice.chosen?.target }) }}>{index === 0 ? 'Today' : choice.date.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })}</button>)}</div>{current.chosen ? <><h3>{current.chosen.title}</h3><p>{current.chosen.description}</p><time dateTime={current.chosen.startsAt}>{new Date(current.chosen.startsAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZone: city.timeZone })} · {city.name}</time><small>Calculated visibility, not a promise of clear weather.</small></> : <p>No suitable target calculated for this location and equipment. Try another day or equipment filter.</p>}</section>
}

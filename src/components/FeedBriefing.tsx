import { useEffect, useState } from 'react'
import { getTonightPlan, type TonightPlan } from '../lib/tonightTargets'
import { fetchViewingForecast, type ViewingForecast } from '../lib/weather'
import { tonightRatingLabel, tonightRatingScore } from '../lib/tonightScore'
import { matchesEquipment, type Equipment } from '../lib/feedEquipment'
import { goNoGo, howToFor, PLANNER_GEARS, type PlannerGear } from '../lib/tonightPlanner.mjs'
import { SKY_NAVIGATION_TERMS } from '../lib/skyNavigationGuide.mjs'
import type { CurrentLocation } from '../lib/currentLocation'

export function FeedBriefing({ city, equipment, catalogueKey }: { city: CurrentLocation; equipment: Equipment; catalogueKey: string }) {
  const [plan, setPlan] = useState<TonightPlan | null>(null)
  const [forecast, setForecast] = useState<ViewingForecast | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [gear, setGear] = useState<PlannerGear>('phone')
  useEffect(() => {
    let active = true
    setLoading(true)
    setPlan(null)
    setForecast(null)
    const now = new Date()
    void (async () => {
      const weather = await fetchViewingForecast(city.lat, city.lon, 7).catch(() => ({ days: [], timeZone: city.timeZone }))
      if (!active) return
      setForecast(weather)
      try {
        const tonight = await getTonightPlan(city.lat, city.lon, now, city.timeZone, weather)
        if (active) setPlan(tonight)
      } finally { if (active) setLoading(false) }
    })().catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [city.lat, city.lon, city.timeZone, attempt, catalogueKey])
  const clock = (value: string | null | undefined) => value ? new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZone: city.timeZone }) : '—'
  const targets = plan?.targets.filter(target => matchesEquipment(target.kind, equipment)) ?? []
  return <section className="feed-briefing" aria-label="Tonight's sky">
    <div className="briefing-heading"><h2>Tonight’s sky</h2><button type="button" className="text-button" onClick={() => setAttempt(value => value + 1)} disabled={loading}>{loading ? 'Updating…' : 'Refresh'}</button></div>
    <div className="briefing-overview">
      <section className="sky-scorecard" aria-label="Tonight's scorecard"><span className="data-label">Observing conditions</span><div className="sky-verdict"><strong>{loading ? '…' : plan?.weatherAvailable ? tonightRatingLabel(plan.rating) : 'Weather unavailable'}</strong>{plan?.weatherAvailable && <span>{tonightRatingScore(plan.rating)}<small>/5</small></span>}</div><dl className="sky-metrics"><div><dt>Cloud</dt><dd>{plan?.todayAdvisory ? `${Math.round(plan.todayAdvisory.cloudCoverPct)}%` : '—'}</dd></div><div><dt>Rain</dt><dd>{plan?.todayAdvisory ? `${Math.round(plan.todayAdvisory.precipitationChancePct)}%` : '—'}</dd></div><div><dt>Moon lit</dt><dd>{plan ? `${Math.round(plan.moonIlluminationPct)}%` : '—'}</dd></div></dl>{plan?.weatherAvailable && plan.reasons[0] && <p className="score-reason">{plan.reasons[0]}</p>}</section>
      <section className="night-window" aria-label="Night timeline"><span className="data-label">When to go out</span><dl><div><dt>Sunset</dt><dd>{clock(plan?.darknessWindow.sunsetAt)}</dd></div><div><dt>Fully dark</dt><dd>{clock(plan?.darknessWindow.astronomicalDuskAt)}</dd></div><div><dt>Dawn</dt><dd>{clock(plan?.darknessWindow.astronomicalDawnAt)}</dd></div></dl>{plan && !plan.darknessWindow.astronomicalDuskAt && <p className="data-note">No full astronomical darkness at this location tonight.</p>}</section>
    </div>
    <section className="forecast-section" aria-label="Seven-night forecast"><div className="briefing-heading"><h3>Night forecast</h3><small>Cloud / rain</small></div>{forecast?.days.length ? <div className="forecast-strip">{forecast.days.map(day => <div className="forecast-day" key={day.date}><time dateTime={day.date}>{new Date(`${day.date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })}</time><span className="weather-symbol" aria-hidden="true">{day.cloudCoverPct < 30 ? '☾' : day.cloudCoverPct < 70 ? '◐' : '☁'}</span><strong>{Math.round(day.cloudCoverPct)}%</strong><span className="cloud-track"><i style={{ width: `${Math.max(0, Math.min(100, day.cloudCoverPct))}%` }} /></span><small>{Math.round(day.precipitationChancePct)}% rain</small></div>)}</div> : <p className="data-note" role="status">{loading ? 'Fetching the night forecast…' : 'Open-Meteo is unavailable. Forecast values are not estimated.'}</p>}</section>
    <section className="tonight-targets" aria-label="Targets tonight"><div className="briefing-heading"><h3>Worth looking for</h3><small>{equipment === 'eye' ? 'Naked eye' : equipment === 'binoculars' ? 'Binoculars' : 'Telescope'}</small></div><div className="target-grid">{targets.map(target => <article className="target-card" key={target.eventId}><span className="data-label">{target.kind.replaceAll('_', ' ')}</span><h4>{target.title}</h4><dl><div><dt>Best time</dt><dd>{clock(target.bestTime)}</dd></div><div><dt>Direction</dt><dd>{target.direction?.compassLabel ?? 'All sky'}</dd></div><div><dt>Altitude</dt><dd>{target.direction ? `${Math.round(target.direction.altitudeDeg)}°` : '—'}</dd></div></dl><small>{target.difficulty}</small></article>)}</div>{!loading && targets.length === 0 && <p className="data-note">No recommended targets for this equipment tonight.</p>}</section>
    {plan && plan.weatherAvailable && <section className="tonight-planner" aria-label="Tonight's planner">
      {(() => {
        const call = goNoGo(plan.rating, plan.todayAdvisory?.cloudCoverPct, plan.moonIlluminationPct)
        const picks = plan.targets.filter(target => target.phoneFriendly).slice(0, 5)
        return <>
          <div className="briefing-heading"><h3>Tonight’s planner</h3><small>{PLANNER_GEARS.find(item => item.id === gear)?.label}</small></div>
          <div className="gear-picker" role="group" aria-label="Your gear">{PLANNER_GEARS.map(item => <button type="button" key={item.id} className="text-button" aria-pressed={gear === item.id} onClick={() => setGear(item.id)}>{item.label}</button>)}</div>
          <p className={`planner-verdict ${call.verdict}`} role="status"><strong>{call.label}</strong> <span>{call.reason}</span></p>
          {call.verdict !== 'no-go' && <ol className="planner-list">{picks.map(target => { const how = howToFor(target.kind, gear); return <li key={target.eventId}><strong>{target.title}</strong> <small>{clock(target.bestTime)} · {target.direction?.compassLabel ?? 'All sky'}</small><p>{how.text} {how.tripod ? 'Use a tripod. ' : ''}{how.timing}</p></li> })}</ol>}
          {call.verdict !== 'no-go' && picks.length === 0 && <p className="data-note">No beginner-friendly targets tonight. Look up and enjoy the stars.</p>}
        </>
      })()}
    </section>}
    <section className="sky-guide" aria-label="Sky navigation guide"><div className="briefing-heading"><h3>Finding things in the sky</h3></div><p className="data-note">Targets above list a direction (azimuth) and height (altitude).</p><dl>{SKY_NAVIGATION_TERMS.map(item => <div key={item.term}><dt>{item.term}</dt><dd>{item.text}</dd></div>)}</dl></section>
    <p className="source-credit">Weather: Open-Meteo · Moon, darkness and positions: Astronomy Engine · Targets: Atlas sky catalogue</p>
  </section>
}

import { useEffect, useState } from 'react'
import { getTonightPlan, type TonightPlan } from '../lib/tonightTargets'
import { fetchViewingForecast, type ViewingForecast } from '../lib/weather'
import { tonightRatingLabel, tonightRatingScore } from '../lib/tonightScore'
import { matchesEquipment, type Equipment } from '../lib/feedEquipment'
import type { CurrentLocation } from '../lib/currentLocation'

export function FeedBriefing({ city, equipment, catalogueKey }: { city: CurrentLocation; equipment: Equipment; catalogueKey: string }) {
  const [plan, setPlan] = useState<TonightPlan | null>(null)
  const [forecast, setForecast] = useState<ViewingForecast | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setPlan(null)
    setForecast(null)
    const now = new Date()
    void Promise.allSettled([getTonightPlan(city.lat, city.lon, now, city.timeZone), fetchViewingForecast(city.lat, city.lon, 7)]).then(([tonight, weather]) => {
      if (!active) return
      if (tonight.status === 'fulfilled') setPlan(tonight.value)
      if (weather.status === 'fulfilled') setForecast(weather.value)
      setLoading(false)
    })
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
    <p className="source-credit">Weather: Open-Meteo · Moon, darkness and positions: Astronomy Engine · Targets: Atlas sky catalogue</p>
  </section>
}

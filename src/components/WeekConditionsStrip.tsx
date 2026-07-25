import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AuthUser } from '../lib/auth'
import { getDisplayName, saveDisplayName } from '../lib/displayName'
import { forecastLookaheadDays, FREE_FORECAST_DAYS } from '../lib/entitlementLimits'
import { estimateLightPollution, rankLowerLightPollutionSites } from '../lib/darkSky'
import { getWeekConditions, type DayCondition } from '../lib/weekConditions'
import { trackEvent } from '../lib/analytics'
import type { TonightPlan } from '../lib/tonightTargets'
import type { CurrentLocation } from '../lib/currentLocation'

// Card cap for the strip itself -- PAID_FORECAST_DAYS (16) is a real ceiling
// for the underlying forecast API, not a sane number of cards to render in a
// single horizontal strip. A week is enough to show "Sky Pass unlocks more".
const STRIP_DAYS = 7

function greetingWeather(plan: TonightPlan | null): string {
  if (!plan?.todayAdvisory) return "conditions are still loading"
  const { quality } = plan.todayAdvisory
  if (quality === 'clear') return 'clear skies'
  if (quality === 'partly-cloudy') return 'partly cloudy'
  return 'cloudy'
}

function formatDay(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })
}

function formatOptimalTime(iso: string | null, timeZone?: string): string {
  if (!iso) return '--'
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone })
}

function moonlightLabel(pct: number): string {
  if (pct < 25) return 'Low moonlight'
  if (pct < 65) return 'Some moonlight'
  return 'Bright moon'
}

function NameEditor() {
  const [name, setName] = useState(() => getDisplayName() ?? '')
  const [editing, setEditing] = useState(() => !getDisplayName())

  if (!editing) {
    return (
      <button type="button" className="feed-greeting-edit-name" onClick={() => setEditing(true)}>
        Not {name}? Edit
      </button>
    )
  }

  function save() {
    saveDisplayName(name)
    setEditing(false)
  }

  return (
    <form
      className="feed-greeting-name-form"
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="What should Atlas call you?"
        maxLength={40}
      />
      <button type="submit">Save</button>
    </form>
  )
}

export function WeekConditionsStrip({
  city,
  plan,
  user,
}: {
  city: CurrentLocation
  plan: TonightPlan | null
  user: AuthUser | null
}) {
  const [days, setDays] = useState<DayCondition[] | null>(null)
  const entitled = Boolean(user?.entitled)
  const unlockedDays = forecastLookaheadDays(entitled)
  const name = getDisplayName()

  useEffect(() => {
    let cancelled = false
    setDays(null)
    getWeekConditions(city.lat, city.lon, STRIP_DAYS)
      .then((result) => {
        if (!cancelled) setDays(result)
      })
      .catch(() => {
        if (!cancelled) setDays([])
      })
    return () => {
      cancelled = true
    }
  }, [city.lat, city.lon])

  const highlights = (plan?.targets ?? []).slice(0, 3).map((target) => target.title)

  const nearbyDarkerSite = entitled ? rankLowerLightPollutionSites(city.lat, city.lon, 1)[0] : null
  const hereLightPollution = entitled && nearbyDarkerSite ? estimateLightPollution(city.lat, city.lon) : null
  const showNearbyAlert =
    entitled &&
    nearbyDarkerSite &&
    hereLightPollution &&
    (nearbyDarkerSite.lightPollutionDelta ?? 0) >= 2 &&
    nearbyDarkerSite.distanceKm <= 150

  return (
    <section className="widget-section feed-header">
      <div className="feed-greeting">
        <p className="feed-greeting-line">
          Hi{name ? `, ${name}` : ''}. Today it&apos;s {greetingWeather(plan)} near {city.name}.
        </p>
        <NameEditor />
      </div>

      {highlights.length > 0 && (
        <p className="feed-highlights">
          You can see: <strong>{highlights.join(', ')}</strong> tonight.
        </p>
      )}

      {showNearbyAlert && nearbyDarkerSite && hereLightPollution && (
        <p className="feed-nearby-alert">
          Darker sky nearby: <strong>{nearbyDarkerSite.name}</strong> is {Math.round(nearbyDarkerSite.distanceKm)} km away
          (Bortle {nearbyDarkerSite.bortleClass} vs {hereLightPollution.bortleClass} here).{' '}
          <Link to="/plan" onClick={() => trackEvent('Nearby darker sky alert clicked', { site: nearbyDarkerSite.id })}>
            Plan a trip
          </Link>
        </p>
      )}

      <h3 className="feed-week-heading">This week&apos;s conditions</h3>
      {days === null ? (
        <p>Loading&hellip;</p>
      ) : days.length === 0 ? (
        <p className="scrapbook-hint">Couldn&apos;t load this week&apos;s forecast right now.</p>
      ) : (
        <div className="week-strip">
          {days.map((day, index) => {
            const locked = index >= unlockedDays
            return (
              <div key={day.date} className={`week-day-card${locked ? ' is-locked' : ''}`}>
                <span className="week-day-label">{formatDay(day.date)}</span>
                {locked ? (
                  <span className="week-day-locked">Sky Pass</span>
                ) : (
                  <>
                    <span className="week-day-metric">☁️ {Math.round(day.cloudCoverPct)}%</span>
                    <span className="week-day-metric">{moonlightLabel(day.moonIlluminationPct)}</span>
                    <span className="week-day-metric">🕘 {formatOptimalTime(day.optimalTimeIso, plan?.timeZone)}</span>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
      {!entitled && unlockedDays < STRIP_DAYS && (
        <p className="scrapbook-hint">
          Free accounts see {FREE_FORECAST_DAYS} days of conditions. <Link to="/settings">Get Sky Pass</Link> to unlock the rest of
          the week and substantially-better-conditions alerts.
        </p>
      )}
    </section>
  )
}

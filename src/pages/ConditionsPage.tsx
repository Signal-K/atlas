import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocation } from '../lib/geo'
import { forecastLookaheadDays, PAID_FORECAST_DAYS } from '../lib/entitlementLimits'
import { getWeekConditions, type DayCondition } from '../lib/weekConditions'
import { tonightRatingLabel } from '../lib/tonightScore'

export interface ConditionsPageProps {
  entitled: boolean
}

function formatDay(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function ConditionsPage({ entitled }: ConditionsPageProps) {
  const { status, coordinates, requestLocation } = useLocation()
  const [days, setDays] = useState<DayCondition[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const visibleDays = forecastLookaheadDays(entitled)
  const lockedDays = PAID_FORECAST_DAYS - visibleDays

  useEffect(() => {
    if (!coordinates) return
    let cancelled = false
    setLoading(true)
    setError('')
    getWeekConditions(coordinates.lat, coordinates.lon, visibleDays)
      .then((result) => {
        if (!cancelled) setDays(result)
      })
      .catch(() => {
        if (!cancelled) setError('Could not reach the weather service. Try again shortly.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [coordinates, visibleDays])

  return (
    <div className="page">
      <div className="page-header">
        <h1>Conditions</h1>
        <p>Cloud cover, moonlight, and the best viewing time for each night.</p>
      </div>

      {status === 'idle' || status === 'pending' ? <p className="ui-empty-state">Getting your location…</p> : null}

      {(status === 'denied' || status === 'unsupported') && (
        <div className="ui-empty-state">
          <p>Atlas needs your location to forecast conditions for the sky above you.</p>
          {status === 'denied' && (
            <button type="button" className="ui-button" onClick={() => requestLocation(true)}>
              Try again
            </button>
          )}
        </div>
      )}

      {error && <p className="ui-empty-state">{error}</p>}

      {loading && <p className="ui-empty-state">Loading forecast…</p>}

      {!loading && !error && coordinates && days.length > 0 && (
        <ul className="ui-list ui-conditions-list">
          {days.map((day) => (
            <li key={day.date} className="ui-list-item ui-conditions-row">
              <div className="ui-conditions-day">{formatDay(day.date)}</div>
              <div className="ui-conditions-metrics">
                <span>Clouds {Math.round(day.cloudCoverPct)}%</span>
                <span>Moon {Math.round(day.moonIlluminationPct)}%</span>
                <span>Best from {formatTime(day.optimalTimeIso)}</span>
              </div>
              <span className={`ui-badge ui-badge-rating-${day.rating.rating}`}>{tonightRatingLabel(day.rating.rating)}</span>
            </li>
          ))}

          {lockedDays > 0 && (
            <li className="ui-list-item ui-conditions-row ui-conditions-locked">
              <span className="ui-badge">Sky Pass</span>
              <span>
                {lockedDays} more day{lockedDays === 1 ? '' : 's'} of conditions with the Sky Pass.{' '}
                <Link to="/app/account">Upgrade</Link>
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

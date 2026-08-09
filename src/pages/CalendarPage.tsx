import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocation } from '../lib/geo'
import { forecastLookaheadDays } from '../lib/entitlementLimits'
import { getCalendarDay, type CalendarDay } from '../lib/calendarDay'
import { fetchObservedTargetNames } from '../lib/observations'
import { tonightRatingLabel } from '../lib/tonightScore'
import { categoryFor } from '../lib/eventCategories'
import type { AuthUser } from '../lib/auth'

export interface CalendarPageProps {
  user: AuthUser
  entitled: boolean
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}

function formatDayHeading(date: Date): string {
  const diffDays = Math.round((startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / 86_400_000)
  const weekday = date.toLocaleDateString(undefined, { weekday: 'long' })
  const rest = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
  if (diffDays === 0) return `Tonight — ${rest}`
  if (diffDays === 1) return `Tomorrow — ${rest}`
  return `${weekday} — ${rest}`
}

function formatClockTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function CalendarPage({ user, entitled }: CalendarPageProps) {
  const { status, coordinates, requestLocation } = useLocation()
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const [day, setDay] = useState<CalendarDay | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const maxAheadDays = forecastLookaheadDays(entitled) - 1
  const dayOffset = Math.round((selectedDate.getTime() - startOfDay(new Date()).getTime()) / 86_400_000)
  const atToday = dayOffset <= 0
  const atLimit = dayOffset >= maxAheadDays

  useEffect(() => {
    if (!coordinates) return
    let cancelled = false
    setLoading(true)
    setError('')
    fetchObservedTargetNames(user.id)
      .then((observed) => getCalendarDay(coordinates.lat, coordinates.lon, selectedDate, observed))
      .then((result) => {
        if (!cancelled) setDay(result)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load conditions for this day. Try again shortly.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [coordinates, selectedDate, user.id])

  const heading = useMemo(() => formatDayHeading(selectedDate), [selectedDate])

  return (
    <div className="page">
      <div className="page-header">
        <h1>Calendar</h1>
        <p>One night at a time — sky conditions, the best window to look up, and what's worth looking for.</p>
      </div>

      {(status === 'idle' || status === 'pending') && <p className="ui-empty-state">Getting your location…</p>}

      {(status === 'denied' || status === 'unsupported') && (
        <div className="ui-empty-state">
          <p>Atlas needs your location to plan the sky above you.</p>
          {status === 'denied' && (
            <button type="button" className="ui-button" onClick={() => requestLocation(true)}>
              Try again
            </button>
          )}
        </div>
      )}

      {coordinates && (
        <>
          <div className="ui-calendar-nav">
            <button type="button" className="ui-button ui-button-ghost" onClick={() => setSelectedDate((d) => addDays(d, -1))} disabled={atToday} aria-label="Previous day">
              ‹
            </button>
            <span className="ui-calendar-heading">{heading}</span>
            <button type="button" className="ui-button ui-button-ghost" onClick={() => setSelectedDate((d) => addDays(d, 1))} disabled={atLimit} aria-label="Next day">
              ›
            </button>
          </div>

          {error && <p className="ui-empty-state">{error}</p>}

          {!entitled && atLimit && (
            <p className="ui-calendar-substat">
              That's as far ahead as a free account can plan. <Link to="/app/account">Upgrade to Sky Pass</Link> to see further out.
            </p>
          )}

          {loading && <p className="ui-empty-state">Loading tonight…</p>}

          {!loading && day && (
            <div className="ui-calendar-day">
              {day.rating && (
                <div className="ui-card ui-calendar-summary">
                  <span className={`ui-badge ui-badge-rating-${day.rating.rating}`}>{tonightRatingLabel(day.rating.rating)}</span>
                  <p>{day.rating.reasons[0]}</p>
                </div>
              )}

              <div className="ui-calendar-grid">
                <div className="ui-card ui-calendar-tile">
                  <span className="ui-section-title">Weather</span>
                  {day.weather ? (
                    <>
                      <p className="ui-calendar-stat">{Math.round(day.weather.cloudCoverPct)}% cloud cover</p>
                      <p className="ui-calendar-substat">{Math.round(day.weather.precipitationChancePct)}% chance of rain overnight</p>
                    </>
                  ) : (
                    <p className="ui-calendar-substat">Forecast not available for this night yet.</p>
                  )}
                </div>

                <div className="ui-card ui-calendar-tile">
                  <span className="ui-section-title">Light pollution</span>
                  {day.lightPollution ? (
                    <>
                      <p className="ui-calendar-stat">
                        Bortle {day.lightPollution.bortleClass} — {day.lightPollution.description}
                      </p>
                      <p className="ui-calendar-substat">{day.lightPollution.whatYouCanSee}</p>
                    </>
                  ) : (
                    <p className="ui-calendar-substat">This location hasn't been sky-brightness mapped yet.</p>
                  )}
                </div>

                <div className="ui-card ui-calendar-tile">
                  <span className="ui-section-title">Optimal window</span>
                  <p className="ui-calendar-stat">
                    {formatClockTime(day.optimalWindow.startIso)} – {formatClockTime(day.optimalWindow.endIso)}
                  </p>
                  <p className="ui-calendar-substat">Astronomical darkness, when the sky is at its darkest</p>
                </div>

                <div className="ui-card ui-calendar-tile">
                  <span className="ui-section-title">Moon</span>
                  <p className="ui-calendar-stat">{Math.round(day.moonIlluminationPct)}% illuminated</p>
                  <p className="ui-calendar-substat">{day.moonIlluminationPct >= 70 ? 'Bright — faint targets will wash out' : day.moonIlluminationPct <= 20 ? 'Dark sky — great for faint targets' : 'Moderate moonlight'}</p>
                </div>
              </div>

              {day.standoutEvent && (
                <Link to={`/app/events/${day.standoutEvent.id}`} className="ui-card ui-calendar-standout">
                  <span className="ui-badge ui-badge-accent">{categoryFor(day.standoutEvent.kind).label} · Tonight's standout</span>
                  <h3>{day.standoutEvent.title}</h3>
                  {day.standoutEvent.description && <p>{day.standoutEvent.description}</p>}
                </Link>
              )}

              {day.cluster && (
                <div className="ui-card ui-calendar-cluster">
                  <div className="ui-calendar-cluster-image">
                    <img src={day.cluster.imageUrl} alt="" />
                  </div>
                  <div className="ui-calendar-cluster-body">
                    <span className="ui-badge ui-badge-accent">Tonight's cluster to photograph</span>
                    <h3>{day.cluster.name}</h3>
                    <p className="ui-calendar-substat">
                      {day.cluster.constellation} · mag {day.cluster.magnitude} · {Math.round(day.cluster.altitudeDeg)}° above the horizon at your optimal window
                    </p>
                    <p>{day.cluster.description}</p>
                    <p className="ui-calendar-substat">{day.cluster.photographyNote}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

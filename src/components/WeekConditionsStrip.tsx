import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AuthUser } from '../lib/auth'
import { getDisplayName, saveDisplayName } from '../lib/displayName'
import { forecastLookaheadDays, FREE_FORECAST_DAYS } from '../lib/entitlementLimits'
import { estimateLightPollution, rankLowerLightPollutionSites } from '../lib/darkSky'
import { getWeekConditions, hasBrightTarget, rateDayCondition, type DayCondition } from '../lib/weekConditions'
import { getEventsInRange, pullSkyEvents } from '../lib/sync'
import { localDateKey } from '../lib/weather'
import { diversifyEvents } from '../lib/eventFilters'
import { trackEvent } from '../lib/analytics'
import { LocationSearchInput } from './LocationSearchInput'
import { InterestsPicker, categoryLabelsForKinds } from './InterestsPicker'
import { getPreferredEventTypes, savePreferredEventTypes } from '../lib/eventPreferences'
import type { City } from '../lib/cities'
import type { SkyEvent } from '../lib/db'
import type { TonightPlan } from '../lib/tonightTargets'
import type { CurrentLocation } from '../lib/currentLocation'

// Card cap for the strip itself -- PAID_FORECAST_DAYS (16) is a real ceiling
// for the underlying forecast API, not a sane number of cards to render in a
// single horizontal strip. A week is enough to show "Sky Pass unlocks more".
const STRIP_DAYS = 7

const RATING_WORD: Record<string, string> = {
  great: 'Great',
  good: 'Good',
  maybe: 'Maybe',
  poor: 'Poor',
  skip: 'Skip',
}

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

function InterestsSummary() {
  const [kinds, setKinds] = useState<string[] | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string[]>([])

  useEffect(() => {
    getPreferredEventTypes().then((result) => {
      setKinds(result)
      setDraft(result)
    })
  }, [])

  function toggle(categoryKinds: string[]) {
    setDraft((current) => {
      const active = categoryKinds.every((kind) => current.includes(kind))
      return active ? current.filter((kind) => !categoryKinds.includes(kind)) : [...new Set([...current, ...categoryKinds])]
    })
  }

  async function save() {
    await savePreferredEventTypes(draft)
    setKinds(draft)
    setEditing(false)
    trackEvent('Set event preferences', { kinds: draft, source: 'feed' })
  }

  if (kinds === null) return null

  const labels = categoryLabelsForKinds(kinds)

  if (!editing) {
    return (
      <p className="feed-interests">
        {labels.length > 0 ? (
          <>
            Your interests: <strong>{labels.join(', ')}</strong>.
          </>
        ) : (
          "You haven't set any interests yet."
        )}{' '}
        <button type="button" className="feed-interests-edit" onClick={() => setEditing(true)}>
          {labels.length > 0 ? 'Edit' : 'Set interests'}
        </button>
      </p>
    )
  }

  return (
    <div className="feed-interests-editor">
      <InterestsPicker selected={draft} onToggleCategory={toggle} />
      <button type="button" className="feed-interests-save" onClick={save} disabled={draft.length === 0}>
        Save
      </button>
    </div>
  )
}

function LocationSwitcher({ onSelect }: { onSelect: (city: City) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  if (!open) {
    return (
      <button type="button" className="feed-location-switch-toggle" onClick={() => setOpen(true)}>
        Change location
      </button>
    )
  }

  return (
    <div className="feed-location-switch">
      <LocationSearchInput
        id="feed-location-switch"
        value={query}
        onChange={setQuery}
        onSelect={(city) => {
          onSelect(city)
          setQuery('')
          setOpen(false)
          trackEvent('Feed location changed', { city: city.name })
        }}
        placeholder="Preview a different town or city"
      />
      <button type="button" className="feed-location-switch-cancel" onClick={() => setOpen(false)} aria-label="Cancel">
        ✕
      </button>
    </div>
  )
}

export function WeekConditionsStrip({
  city,
  plan,
  user,
  setManualLocation,
}: {
  city: CurrentLocation
  plan: TonightPlan | null
  user: AuthUser | null
  setManualLocation?: (city: City | null) => void
}) {
  const [days, setDays] = useState<DayCondition[] | null>(null)
  const [weekEvents, setWeekEvents] = useState<SkyEvent[]>([])
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

  useEffect(() => {
    let cancelled = false
    async function load() {
      await pullSkyEvents()
      const start = new Date()
      const end = new Date(start.getTime() + STRIP_DAYS * 86_400_000)
      const events = await getEventsInRange(start, end)
      if (!cancelled) setWeekEvents(events)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [city.lat, city.lon])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, SkyEvent[]>()
    for (const event of weekEvents) {
      const key = localDateKey(event.startsAt, plan?.timeZone)
      const list = map.get(key) ?? []
      list.push(event)
      map.set(key, list)
    }
    return map
  }, [weekEvents, plan?.timeZone])

  const highlights = (plan?.targets ?? []).slice(0, 3).map((target) => target.title)

  const nearbyDarkerSite = entitled ? rankLowerLightPollutionSites(city.lat, city.lon, 1)[0] : null
  const hereLightPollution = entitled && nearbyDarkerSite ? estimateLightPollution(city.lat, city.lon) : null
  const showNearbyAlert =
    entitled &&
    nearbyDarkerSite &&
    hereLightPollution &&
    (nearbyDarkerSite.lightPollutionDelta ?? 0) >= 2 &&
    nearbyDarkerSite.distanceKm <= 150

  function changeLocation(nextCity: City) {
    setManualLocation?.(nextCity)
  }

  return (
    <section className="widget-section feed-header">
      <div className="feed-greeting">
        <p className="feed-greeting-line">
          Hi{name ? `, ${name}` : ''}. Today it&apos;s {greetingWeather(plan)} near {city.name}.
        </p>
        <div className="feed-greeting-controls">
          <NameEditor />
          {entitled && setManualLocation && <LocationSwitcher onSelect={changeLocation} />}
        </div>
      </div>

      {highlights.length > 0 && (
        <p className="feed-highlights">
          You can see: <strong>{highlights.join(', ')}</strong> tonight.
        </p>
      )}

      <InterestsSummary />

      {showNearbyAlert && nearbyDarkerSite && hereLightPollution && (
        <p className="feed-nearby-alert">
          Darker sky nearby: <strong>{nearbyDarkerSite.name}</strong> is {Math.round(nearbyDarkerSite.distanceKm)} km away
          (Bortle {nearbyDarkerSite.bortleClass} vs {hereLightPollution.bortleClass} here).{' '}
          <Link to="/app/plan" onClick={() => trackEvent('Nearby darker sky alert clicked', { site: nearbyDarkerSite.id })}>
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
            const dayEvents = eventsByDate.get(day.date) ?? []
            const rating = entitled && !locked ? rateDayCondition(day, hasBrightTarget(dayEvents.map((e) => e.kind))) : null
            const dayHighlights = diversifyEvents(dayEvents, 2).map((e) => e.title)
            return (
              <div key={day.date} className={`week-day-card${locked ? ' is-locked' : ''}`}>
                <span className="week-day-label">{formatDay(day.date)}</span>
                {locked ? (
                  <span className="week-day-locked">Sky Pass</span>
                ) : (
                  <>
                    {rating && (
                      <span className={`week-day-rating week-day-rating--${rating.rating}`}>{RATING_WORD[rating.rating]}</span>
                    )}
                    <span className="week-day-metric">☁️ {Math.round(day.cloudCoverPct)}%</span>
                    <span className="week-day-metric">{moonlightLabel(day.moonIlluminationPct)}</span>
                    <span className="week-day-metric">🕘 {formatOptimalTime(day.optimalTimeIso, plan?.timeZone)}</span>
                    {rating && dayHighlights.length > 0 && (
                      <span className="week-day-highlights">{dayHighlights.join(', ')}</span>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
      {!entitled && unlockedDays < STRIP_DAYS && (
        <p className="scrapbook-hint">
          Free accounts see {FREE_FORECAST_DAYS} days of conditions. <Link to="/app/settings">Get Sky Pass</Link> to unlock the rest of
          the week, per-day ratings, substantially-better-conditions alerts, and location preview.
        </p>
      )}
    </section>
  )
}

// Composes every signal the Calendar page's daily card needs -- weather,
// light pollution, the darkness window, a standout sky_events pick, and a
// well-placed cluster recommendation -- into one lookup per day, so the page
// component itself stays presentational.
import { getDarknessWindow } from './darknessWindow'
import { moonIlluminationPctAt } from './moonPhase'
import { fetchViewingForecast, type DailyViewingAdvisory, type ViewingForecast } from './weather'
import { fetchNearestLightPollution, type LightPollutionReading } from './lightPollution'
import { fetchUpcomingEvents, type AtlasEvent } from './events'
import { pickTonightCluster, type TonightCluster } from './clusters'
import { scoreTonight, type TonightScoreResult } from './tonightScore'

export interface CalendarDay {
  date: string
  weather: DailyViewingAdvisory | null
  moonIlluminationPct: number
  optimalWindow: { startIso: string | null; endIso: string | null }
  rating: TonightScoreResult | null
  lightPollution: LightPollutionReading | null
  standoutEvent: AtlasEvent | null
  cluster: TonightCluster | null
}

// Rough "what's worth leading with" order -- rare/short-window events first;
// the perennial "well placed tonight" deep-sky posts sort last since
// scripts/sources/deep-sky-objects.mjs recurs constantly and would
// otherwise dominate every single day's pick.
const STANDOUT_PRIORITY: Record<string, number> = {
  eclipse: 0,
  aurora: 1,
  meteor_shower: 2,
  conjunction: 3,
  asteroid_approach: 4,
  fireball: 5,
  comet: 6,
  planet_event: 7,
  solar_flare: 8,
  galaxy: 9,
  nebula: 9,
  cluster: 9,
  deep_sky: 9,
  iss_pass: 10,
  satellite_flare: 11,
  moon_phase: 12,
  local_night_sky: 13,
}

function pickStandoutEvent(events: AtlasEvent[]): AtlasEvent | null {
  if (events.length === 0) return null
  return [...events].sort((a, b) => (STANDOUT_PRIORITY[a.kind] ?? 99) - (STANDOUT_PRIORITY[b.kind] ?? 99))[0]
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export async function getCalendarDay(lat: number, lon: number, date: Date, alreadyObservedNames: Set<string>): Promise<CalendarDay> {
  const today = startOfDay(new Date())
  const diffDays = Math.round((startOfDay(date).getTime() - today.getTime()) / 86_400_000)
  // Open-Meteo tops out at 16 forecast days (see weather.ts); clamp rather
  // than requesting a range it will reject.
  const forecastDays = Math.min(16, Math.max(1, diffDays + 1))
  const eventWindowDays = Math.max(1, diffDays + 2)

  const [forecast, lightPollution, events] = await Promise.all([
    fetchViewingForecast(lat, lon, forecastDays).catch((): ViewingForecast => ({ days: [] })),
    fetchNearestLightPollution(lat, lon),
    fetchUpcomingEvents(eventWindowDays).catch(() => []),
  ])

  // Open-Meteo's `daily.time` keys are the *observed location's* local
  // calendar date (timezone=auto), not the browser's -- a device west or
  // east of the viewed location can disagree with it on what day "tonight"
  // falls on near midnight. Deriving dateKey from the browser's own
  // toISOString() (always UTC) silently dropped weather/events whenever the
  // two diverged, so key off the location's timezone instead when it's
  // known; the browser's local date is the only sane fallback if the
  // forecast fetch failed.
  const dateKey = forecast.timeZone
    ? new Intl.DateTimeFormat('en-CA', { timeZone: forecast.timeZone }).format(date)
    : date.toISOString().slice(0, 10)

  const weather = forecast.days.find((day) => day.date === dateKey) ?? null
  const moonIlluminationPct = moonIlluminationPctAt(date)

  const dayStart = startOfDay(date)
  const dayEnd = new Date(dayStart.getTime() + 2 * 86_400_000)
  const window = getDarknessWindow(lat, lon, dayStart, dayEnd)
  const optimalWindow = {
    startIso: window.astronomicalDuskAt ?? window.civilDuskAt,
    endIso: window.astronomicalDawnAt ?? window.civilDawnAt,
  }

  const rating = weather
    ? scoreTonight({
        cloudCoverPct: weather.cloudCoverPct,
        precipitationChancePct: weather.precipitationChancePct,
        moonIlluminationPct,
        hasBrightTarget: false,
      })
    : null

  // Same location-timezone reasoning as dateKey above -- an event just
  // after local midnight at the viewed location must still match "tonight"
  // even if it's still the previous UTC calendar day.
  const eventDateKey = (iso: string) =>
    forecast.timeZone ? new Intl.DateTimeFormat('en-CA', { timeZone: forecast.timeZone }).format(new Date(iso)) : new Date(iso).toISOString().slice(0, 10)
  const dayEvents = events.filter((event) => eventDateKey(event.starts_at) === dateKey)
  const standoutEvent = pickStandoutEvent(dayEvents)

  // Falls back to 10pm local on the target date when twilight search can't
  // resolve (near the poles in summer, see getDarknessWindow) so a cluster
  // pick still renders instead of silently disappearing.
  const clusterAt = optimalWindow.startIso ? new Date(optimalWindow.startIso) : new Date(dayStart.getTime() + 22 * 3_600_000)
  const cluster = pickTonightCluster(lat, lon, clusterAt, alreadyObservedNames)

  return { date: dateKey, weather, moonIlluminationPct, optimalWindow, rating, lightPollution, standoutEvent, cluster }
}

// Feed/Tonight "week conditions" strip (per the 2026-07 Atlas user-flow
// notes): a day-by-day view of the three signals that decide whether a
// night is worth going outside for -- cloud coverage, moonlight (the
// dominant night-to-night light-pollution swing, on top of the fixed Bortle
// class from darkSky.ts), and the optimal viewing time. Free accounts see
// FREE_FORECAST_DAYS of this; Sky Pass unlocks the rest (see
// entitlementLimits.ts).
import { moonIlluminationPctAt } from './moonPhase'
import { getDarknessWindow } from './tonightTargets'
import { fetchViewingForecast, type DailyViewingAdvisory } from './weather'
import { scoreTonight, type TonightScoreResult } from './tonightScore'

// Kinds bright enough that moon glare barely matters, mirroring
// tonightTargets.ts's own hasBrightTarget rationale -- kept as a separate,
// smaller list here since the week strip only needs it for the day rating,
// not full target ranking.
const BRIGHT_KINDS = new Set(['moon_phase', 'planet_event', 'iss_pass', 'conjunction'])

export function hasBrightTarget(kinds: string[]): boolean {
  return kinds.some((kind) => BRIGHT_KINDS.has(kind))
}

// Sky Pass per-day rating ("Premium users get an extra header for each
// day, showing an estimate of how good that day is, based on conditions
// and what they can see"). Reuses the same pure scorer as tonight's own
// rating so the language stays consistent across the app.
export function rateDayCondition(day: DayCondition, dayHasBrightTarget: boolean): TonightScoreResult {
  return scoreTonight({
    cloudCoverPct: day.cloudCoverPct,
    precipitationChancePct: day.precipitationChancePct,
    moonIlluminationPct: day.moonIlluminationPct,
    hasBrightTarget: dayHasBrightTarget,
  })
}

export interface DayCondition extends DailyViewingAdvisory {
  moonIlluminationPct: number
  optimalTimeIso: string | null
}

// Astronomical dusk is the honest "sky is properly dark" moment; civil dusk
// is the best fallback near the poles in summer where the Sun never gets
// that low (see getDarknessWindow's own caveat).
function optimalTimeForDay(lat: number, lon: number, date: Date): string | null {
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart.getTime() + 2 * 86_400_000)
  const window = getDarknessWindow(lat, lon, dayStart, dayEnd)
  return window.astronomicalDuskAt ?? window.civilDuskAt
}

export async function getWeekConditions(lat: number, lon: number, days: number): Promise<DayCondition[]> {
  const forecast = await fetchViewingForecast(lat, lon, days)
  return forecast.days.map((day) => {
    const date = new Date(`${day.date}T12:00:00`)
    return {
      ...day,
      moonIlluminationPct: moonIlluminationPctAt(date),
      optimalTimeIso: optimalTimeForDay(lat, lon, date),
    }
  })
}

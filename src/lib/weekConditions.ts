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

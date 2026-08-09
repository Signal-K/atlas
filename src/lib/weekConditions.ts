// Conditions page: a day-by-day view of the signals that decide whether a
// night is worth going outside for -- cloud coverage, moonlight, and the
// optimal (astronomical-dusk) viewing time. Free accounts see
// FREE_FORECAST_DAYS of this; Sky Pass unlocks the rest (see
// entitlementLimits.ts).
import { getDarknessWindow } from './darknessWindow'
import { moonIlluminationPctAt } from './moonPhase'
import { scoreTonight, type TonightScoreResult } from './tonightScore'
import { fetchViewingForecast, type DailyViewingAdvisory } from './weather'

export interface DayCondition extends DailyViewingAdvisory {
  moonIlluminationPct: number
  optimalTimeIso: string | null
  rating: TonightScoreResult
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
    const moonIlluminationPct = moonIlluminationPctAt(date)
    return {
      ...day,
      moonIlluminationPct,
      optimalTimeIso: optimalTimeForDay(lat, lon, date),
      rating: scoreTonight({
        cloudCoverPct: day.cloudCoverPct,
        precipitationChancePct: day.precipitationChancePct,
        moonIlluminationPct,
        hasBrightTarget: false,
      }),
    }
  })
}

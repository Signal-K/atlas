export interface DailyViewingAdvisory {
  date: string // YYYY-MM-DD
  cloudCoverPct: number
  precipitationChancePct: number
  quality: 'clear' | 'partly-cloudy' | 'cloudy'
}

export interface ViewingForecast {
  days: DailyViewingAdvisory[]
  timeZone?: string
}

// Open-Meteo: free, no API key, CORS-enabled for browser use.
// https://open-meteo.com/en/docs
export async function fetchViewingForecast(lat: number, lon: number, days = 7): Promise<ViewingForecast> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('daily', 'cloud_cover_mean,precipitation_probability_mean')
  url.searchParams.set('hourly', 'cloud_cover,precipitation_probability')
  // A night belongs to its evening date but includes the following morning.
  // Request one extra calendar day whenever the API ceiling allows it, so a
  // one-day request still contains 00:00-06:00 tomorrow.
  const requestedDays = Math.min(days + 1, 16)
  url.searchParams.set('forecast_days', String(requestedDays))
  url.searchParams.set('timezone', 'auto')

  // No timeout here would leave the Conditions page stuck on "Loading..."
  // for as long as the browser's own TCP timeout whenever Open-Meteo was
  // slow or unreachable, since a hung fetch never rejects for a .catch() to
  // handle. AbortSignal.timeout turns that into a real, bounded failure.
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error(`Open-Meteo request failed: ${response.status}`)
  const data = await response.json()

  const dates: string[] = data.daily?.time ?? []
  const cloudCover: number[] = data.daily?.cloud_cover_mean ?? []
  const precipitation: number[] = data.daily?.precipitation_probability_mean ?? []
  const hourlyDates: string[] = data.hourly?.time ?? []
  const hourlyCloud: Array<number | null> = data.hourly?.cloud_cover ?? []
  const hourlyPrecipitation: Array<number | null> = data.hourly?.precipitation_probability ?? []

  // Open-Meteo timestamps are returned in the requested location's local
  // time. Associate an evening with its following early-morning hours so a
  // "Monday night" forecast covers Monday 18:00 through Tuesday 05:59,
  // rather than using a whole-day average dominated by daylight weather.
  function nextDateKey(date: string): string {
    const next = new Date(`${date}T12:00:00Z`)
    next.setUTCDate(next.getUTCDate() + 1)
    return next.toISOString().slice(0, 10)
  }

  function nightlyAverage(values: Array<number | null>, date: string): number | undefined {
    const nextDate = nextDateKey(date)
    const matching = values.filter((value, index) => {
      if (typeof value !== 'number') return false
      const timestamp = hourlyDates[index]
      const timestampDate = timestamp?.slice(0, 10)
      const hour = Number(timestamp?.slice(11, 13))
      return (timestampDate === date && hour >= 18) || (timestampDate === nextDate && hour < 6)
    }) as number[]
    if (matching.length === 0) return undefined
    return matching.reduce((sum, value) => sum + value, 0) / matching.length
  }

  const forecastDays: DailyViewingAdvisory[] = dates.slice(0, days).map((date, i) => {
    // Keep the daily fields as a compatibility fallback for cached responses
    // and test fixtures created before hourly viewing-window data was added.
    const cloudCoverPct = nightlyAverage(hourlyCloud, date) ?? cloudCover[i] ?? 100
    const precipitationChancePct = nightlyAverage(hourlyPrecipitation, date) ?? precipitation[i] ?? 0
    return {
      date,
      cloudCoverPct,
      precipitationChancePct,
      quality: cloudCoverPct < 30 ? 'clear' : cloudCoverPct < 70 ? 'partly-cloudy' : 'cloudy',
    }
  })
  return { days: forecastDays, timeZone: typeof data.timezone === 'string' ? data.timezone : undefined }
}

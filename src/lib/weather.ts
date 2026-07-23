export interface DailyViewingAdvisory {
  date: string // YYYY-MM-DD
  cloudCoverPct: number
  /** Hourly layer averages; useful because high thin cloud is less obstructive than low cloud. */
  lowCloudCoverPct?: number
  highCloudCoverPct?: number
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
  url.searchParams.set('hourly', 'cloud_cover_low,cloud_cover_high')
  url.searchParams.set('forecast_days', String(days))
  url.searchParams.set('timezone', 'auto')

  const response = await fetch(url)
  if (!response.ok) throw new Error(`Open-Meteo request failed: ${response.status}`)
  const data = await response.json()

  const dates: string[] = data.daily?.time ?? []
  const cloudCover: number[] = data.daily?.cloud_cover_mean ?? []
  const precipitation: number[] = data.daily?.precipitation_probability_mean ?? []
  const hourlyDates: string[] = data.hourly?.time ?? []
  const hourlyLow: Array<number | null> = data.hourly?.cloud_cover_low ?? []
  const hourlyHigh: Array<number | null> = data.hourly?.cloud_cover_high ?? []

  function layerAverageForDate(values: Array<number | null>, date: string): number | undefined {
    const matching = values.filter((value, index) => hourlyDates[index]?.slice(0, 10) === date && typeof value === 'number') as number[]
    if (matching.length === 0) return undefined
    return matching.reduce((sum, value) => sum + value, 0) / matching.length
  }

  const forecastDays: DailyViewingAdvisory[] = dates.map((date, i) => {
    const cloudCoverPct = cloudCover[i] ?? 100
    return {
      date,
      cloudCoverPct,
      lowCloudCoverPct: layerAverageForDate(hourlyLow, date),
      highCloudCoverPct: layerAverageForDate(hourlyHigh, date),
      precipitationChancePct: precipitation[i] ?? 0,
      quality: cloudCoverPct < 30 ? 'clear' : cloudCoverPct < 70 ? 'partly-cloudy' : 'cloudy',
    }
  })
  return { days: forecastDays, timeZone: typeof data.timezone === 'string' ? data.timezone : undefined }
}

export async function fetchViewingAdvisory(lat: number, lon: number, days = 7): Promise<DailyViewingAdvisory[]> {
  return (await fetchViewingForecast(lat, lon, days)).days
}

// STS-319: when tonight is cloudy, the plan screen's weather section offers
// the nearest better night instead of just saying "skip" — the first
// upcoming day (today excluded) that isn't fully clouded, or, failing that,
// whichever upcoming day has the least cloud cover.
export function findNextClearWindow(advisory: DailyViewingAdvisory[]): DailyViewingAdvisory | null {
  const upcoming = advisory.slice(1)
  if (upcoming.length === 0) return null
  return upcoming.find((day) => day.quality !== 'cloudy') ?? upcoming.reduce((best, day) => (day.cloudCoverPct < best.cloudCoverPct ? day : best))
}

import { useEffect, useState } from 'react'
import { registerWidget } from './registry'
import { fetchViewingForecast, localDateKey, type DailyViewingAdvisory } from '../lib/weather'
import { getUpcomingEvents } from '../lib/sync'
import { getWatchlist, matchesWatchlist } from '../lib/watchlist'
import { useLocationBrowse } from '../lib/locationBrowseContext'
import { useAuth } from '../lib/auth'
import { forecastLookaheadDays } from '../lib/entitlementLimits'

const QUALITY_LABEL: Record<DailyViewingAdvisory['quality'], string> = {
  clear: 'Clear',
  'partly-cloudy': 'Partly cloudy',
  cloudy: 'Cloudy',
}

function WeatherWidget() {
  const { city } = useLocationBrowse()
  const { user } = useAuth()
  const forecastDays = forecastLookaheadDays(Boolean(user?.entitled))
  const [advisory, setAdvisory] = useState<DailyViewingAdvisory[] | null>(null)
  const [error, setError] = useState(false)
  const [watchedEventsByDate, setWatchedEventsByDate] = useState<Map<string, string[]>>(new Map())

  useEffect(() => {
    let cancelled = false
    setAdvisory(null)
    setError(false)

    async function loadWatchedEvents(timeZone: string | undefined) {
      const [watchlist, upcoming] = await Promise.all([getWatchlist(), getUpcomingEvents(200)])
      const byDate = new Map<string, string[]>()
      for (const event of upcoming) {
        if (!matchesWatchlist(event, watchlist)) continue
        const date = localDateKey(event.startsAt, timeZone)
        const titles = byDate.get(date) ?? []
        titles.push(event.title)
        byDate.set(date, titles)
      }
      if (!cancelled) setWatchedEventsByDate(byDate)
    }

    fetchViewingForecast(city.lat, city.lon, forecastDays)
      .then((forecast) => {
        if (cancelled) return
        const timeZone = city.timeZone ?? forecast.timeZone
        setAdvisory(forecast.days)
        loadWatchedEvents(timeZone)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })

    return () => {
      cancelled = true
    }
  }, [city, forecastDays])

  if (error) return <p>Couldn&apos;t reach the weather forecast — try again once you&apos;re back online.</p>
  if (advisory === null) return <p>Loading&hellip;</p>

  return (
    <div>
      <p className="scrapbook-hint">
        Cloud-cover forecast for <strong>{city.name}</strong>, from Open-Meteo. Days lining up with something on your
        watchlist are called out below.
        {!user?.entitled && <> Sky Pass unlocks the full forecast beyond the next {forecastDays} days.</>}
      </p>
      <ul className="weather-strip">
        {advisory.map((day) => {
          const watched = watchedEventsByDate.get(day.date) ?? []
          return (
            <li key={day.date} className={`weather-day weather-day--${day.quality}`}>
              <span className="weather-day-date">
                {new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
              </span>
              <span className="weather-day-quality">{QUALITY_LABEL[day.quality]}</span>
              <span className="weather-day-cover">{Math.round(day.cloudCoverPct)}% cloud</span>
              {day.lowCloudCoverPct != null && day.highCloudCoverPct != null && (
                <span className="weather-day-advisory">
                  Low {Math.round(day.lowCloudCoverPct)}% · high {Math.round(day.highCloudCoverPct)}%
                </span>
              )}
              {watched.length > 0 && day.quality !== 'cloudy' && (
                <span className="weather-day-advisory">Good night for {watched[0]}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

registerWidget({
  id: 'weather',
  title: 'Clear-weather advisory',
  Component: WeatherWidget,
  defaultEnabled: true,
})

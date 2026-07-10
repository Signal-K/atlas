import { useEffect, useState } from 'react'
import { registerWidget } from './registry'
import { fetchViewingAdvisory, type DailyViewingAdvisory } from '../lib/weather'
import { getUpcomingEvents } from '../lib/sync'
import { getWatchlist, matchesWatchlist } from '../lib/watchlist'
import { useLocationBrowse } from '../lib/locationBrowseContext'

const QUALITY_LABEL: Record<DailyViewingAdvisory['quality'], string> = {
  clear: 'Clear',
  'partly-cloudy': 'Partly cloudy',
  cloudy: 'Cloudy',
}

function WeatherWidget() {
  const { city } = useLocationBrowse()
  const [advisory, setAdvisory] = useState<DailyViewingAdvisory[] | null>(null)
  const [error, setError] = useState(false)
  const [watchedEventsByDate, setWatchedEventsByDate] = useState<Map<string, string[]>>(new Map())

  useEffect(() => {
    let cancelled = false
    setAdvisory(null)
    setError(false)

    fetchViewingAdvisory(city.lat, city.lon)
      .then((result) => {
        if (!cancelled) setAdvisory(result)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })

    async function loadWatchedEvents() {
      const [watchlist, upcoming] = await Promise.all([getWatchlist(), getUpcomingEvents(200)])
      const byDate = new Map<string, string[]>()
      for (const event of upcoming) {
        if (!matchesWatchlist(event, watchlist)) continue
        const date = event.startsAt.slice(0, 10)
        const titles = byDate.get(date) ?? []
        titles.push(event.title)
        byDate.set(date, titles)
      }
      if (!cancelled) setWatchedEventsByDate(byDate)
    }
    loadWatchedEvents()

    return () => {
      cancelled = true
    }
  }, [city])

  if (error) return <p>Couldn&apos;t reach the weather forecast — try again once you&apos;re back online.</p>
  if (advisory === null) return <p>Loading&hellip;</p>

  return (
    <div>
      <p className="scrapbook-hint">
        Cloud-cover forecast for <strong>{city.name}</strong>, from Open-Meteo. Days lining up with something on your
        watchlist are called out below.
      </p>
      <ul className="weather-strip">
        {advisory.map((day) => {
          const watched = watchedEventsByDate.get(day.date) ?? []
          return (
            <li key={day.date} className={`weather-day weather-day--${day.quality}`}>
              <span className="weather-day-date">
                {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
              </span>
              <span className="weather-day-quality">{QUALITY_LABEL[day.quality]}</span>
              <span className="weather-day-cover">{Math.round(day.cloudCoverPct)}% cloud</span>
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

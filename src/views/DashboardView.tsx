import { useEffect, useMemo, useState } from 'react'
import './../widgets/UpcomingEventsWidget'
import './../widgets/WatchlistWidget'
import './../widgets/WeatherWidget'
import './../widgets/StreakWidget'
import './../widgets/CitizenScienceWidget'
import './../widgets/DigestWidget'
import './../widgets/LeaderboardWidget'
import { getOrderedWidgets } from '../widgets/registry'
import { OnboardingCTA } from '../components/OnboardingCTA'
import { WorldMap } from '../components/WorldMap'
import { LocationBrowseProvider, useLocationBrowse } from '../lib/locationBrowseContext'
import { CITIES, type City } from '../lib/cities'
import { getUpcomingEvents, pullSkyEvents } from '../lib/sync'
import type { SkyEvent } from '../lib/db'
import type { CurrentLocation } from '../lib/currentLocation'

function eventsForCity(events: SkyEvent[], city: City): SkyEvent[] {
  return events.filter((event) => {
    if (event.latitude == null || event.longitude == null) return true
    return Math.abs(event.latitude - city.lat) < 0.01 && Math.abs(event.longitude - city.lon) < 0.01
  })
}

function LocationPicker() {
  const { city, setCity } = useLocationBrowse()
  const [events, setEvents] = useState<SkyEvent[] | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      await pullSkyEvents()
      const upcoming = await getUpcomingEvents(400)
      if (!cancelled) setEvents(upcoming)
    }

    load()
    window.addEventListener('online', load)
    return () => {
      cancelled = true
      window.removeEventListener('online', load)
    }
  }, [])

  const eventCounts = useMemo(() => {
    if (!events) return new Map<string, number>()
    return new Map(CITIES.map((candidate) => [candidate.name, eventsForCity(events, candidate).length]))
  }, [events])

  const selectedCount = events ? eventsForCity(events, city).length : 0
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const searchResults = normalizedQuery
    ? CITIES.filter((candidate) => candidate.name.toLocaleLowerCase().includes(normalizedQuery)).slice(0, 8)
    : []

  return (
    <section className="widget-section">
      <div className="map-card-header">
        <h2>Browse the world</h2>
        <span className="map-location-current">Using {city.name}</span>
      </div>
      <div className="map-location-search">
        <label htmlFor="world-location-search">Browse another city</label>
        <input
          id="world-location-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search cities"
        />
        {searchResults.length > 0 && (
          <div className="map-location-results" role="listbox" aria-label="City search results">
            {searchResults.map((candidate) => (
              <button
                type="button"
                key={candidate.name}
                onClick={() => {
                  setCity(candidate)
                  setQuery('')
                }}
              >
                {candidate.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="map-card">
        <WorldMap selected={city} onSelect={setCity} eventCounts={eventCounts} />
      </div>
      <p className="scrapbook-hint">
        {events === null ? 'Loading event counts. ' : `${selectedCount} upcoming events are available for ${city.name}. `}
        ISS passes are shown for <strong>{city.name}</strong>. Moon phases, meteor showers, planets, eclipses, and
        deep-sky objects are shown regardless of location. This browser starts at your current location; use search or the map to compare another place.
      </p>
    </section>
  )
}

export function DashboardView({ onSignUpClick, defaultCity }: { onSignUpClick: () => void; defaultCity: CurrentLocation }) {
  const widgets = getOrderedWidgets().filter((widget) => widget.enabled)

  return (
    <LocationBrowseProvider defaultCity={defaultCity}>
      <div className="widget-stack">
        <OnboardingCTA onSignUpClick={onSignUpClick} />
        {widgets.map(({ id, title, Component }) => (
          <section key={id} className="widget-section">
            <h2>{title}</h2>
            <Component />
          </section>
        ))}
        <LocationPicker />
      </div>
    </LocationBrowseProvider>
  )
}

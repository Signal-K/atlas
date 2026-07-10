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

function eventsForCity(events: SkyEvent[], city: City): SkyEvent[] {
  return events.filter((event) => {
    if (event.latitude == null || event.longitude == null) return true
    return Math.abs(event.latitude - city.lat) < 0.01 && Math.abs(event.longitude - city.lon) < 0.01
  })
}

function LocationPicker() {
  const { city, setCity } = useLocationBrowse()
  const [events, setEvents] = useState<SkyEvent[] | null>(null)

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

  const selectedCount = eventCounts.get(city.name) ?? 0

  return (
    <section className="widget-section">
      <div className="map-card-header">
        <h2>Browse the world</h2>
        <select
          className="map-location-select"
          value={city.name}
          onChange={(event) => {
            const next = CITIES.find((c) => c.name === event.target.value)
            if (next) setCity(next)
          }}
        >
          {CITIES.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="map-card">
        <WorldMap selected={city} onSelect={setCity} eventCounts={eventCounts} />
      </div>
      <p className="scrapbook-hint">
        {events === null ? 'Loading event counts. ' : `${selectedCount} upcoming events are available for ${city.name}. `}
        ISS passes are shown for <strong>{city.name}</strong>. Moon phases, meteor showers, planets, eclipses, and
        deep-sky objects are shown regardless of location. Not your location? Pick your city above or on the map —
        it's remembered from now on, even if your browser's geolocation guesses wrong.
      </p>
    </section>
  )
}

export function DashboardView({ onSignUpClick, defaultCity }: { onSignUpClick: () => void; defaultCity: City }) {
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

import './../widgets/UpcomingEventsWidget'
import { listWidgets } from '../widgets/registry'
import { OnboardingCTA } from '../components/OnboardingCTA'
import { WorldMap } from '../components/WorldMap'
import { LocationBrowseProvider, useLocationBrowse } from '../lib/locationBrowseContext'
import type { City } from '../lib/cities'

function LocationPicker() {
  const { city, setCity } = useLocationBrowse()
  return (
    <section className="widget-section">
      <h2>Browse the world</h2>
      <p className="scrapbook-hint">
        ISS passes are location-specific — pick a city to see passes for that location. Moon phases, meteor showers,
        and eclipses are shown regardless of location.
      </p>
      <WorldMap selected={city} onSelect={setCity} />
      <p className="map-selected-city">Showing ISS passes for {city.name}</p>
    </section>
  )
}

export function DashboardView({ onSignUpClick, defaultCity }: { onSignUpClick: () => void; defaultCity: City }) {
  const widgets = listWidgets()

  return (
    <LocationBrowseProvider defaultCity={defaultCity}>
      <div className="widget-stack">
        <OnboardingCTA onSignUpClick={onSignUpClick} />
        <LocationPicker />
        {widgets.map(({ id, title, Component }) => (
          <section key={id} className="widget-section">
            <h2>{title}</h2>
            <Component />
          </section>
        ))}
      </div>
    </LocationBrowseProvider>
  )
}

import './../widgets/UpcomingEventsWidget'
import { listWidgets } from '../widgets/registry'
import { OnboardingCTA } from '../components/OnboardingCTA'
import { WorldMap } from '../components/WorldMap'
import { LocationBrowseProvider, useLocationBrowse } from '../lib/locationBrowseContext'
import { CITIES, type City } from '../lib/cities'

function LocationPicker() {
  const { city, setCity } = useLocationBrowse()
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
        <WorldMap selected={city} onSelect={setCity} />
      </div>
      <p className="scrapbook-hint">
        ISS passes are shown for <strong>{city.name}</strong>. Moon phases, meteor showers, planets, eclipses, and
        deep-sky objects are shown regardless of location.
      </p>
    </section>
  )
}

export function DashboardView({ onSignUpClick, defaultCity }: { onSignUpClick: () => void; defaultCity: City }) {
  const widgets = listWidgets()

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

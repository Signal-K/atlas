import { createContext, useContext, useState, type ReactNode } from 'react'
import { CITIES, type City } from './cities'

interface LocationBrowseValue {
  city: City
  setCity: (city: City) => void
}

const LocationBrowseContext = createContext<LocationBrowseValue | null>(null)

const STORAGE_KEY = 'atlas-browse-city'

function getStoredCity(): City | null {
  const name = localStorage.getItem(STORAGE_KEY)
  if (!name) return null
  return CITIES.find((c) => c.name === name) ?? null
}

export function LocationBrowseProvider({ defaultCity, children }: { defaultCity: City; children: ReactNode }) {
  // A city the user has explicitly picked before takes priority over the
  // geolocation-derived default — otherwise a manual pick gets silently
  // reverted whenever geolocation resolves late (DashboardView remounts on
  // defaultCity change) or on the next page load, which reads as "the app
  // keeps defaulting to the wrong city" even after correcting it once.
  const [city, setCityState] = useState<City>(() => getStoredCity() ?? defaultCity)

  function setCity(next: City) {
    setCityState(next)
    localStorage.setItem(STORAGE_KEY, next.name)
  }

  return <LocationBrowseContext.Provider value={{ city, setCity }}>{children}</LocationBrowseContext.Provider>
}

export function useLocationBrowse(): LocationBrowseValue {
  const context = useContext(LocationBrowseContext)
  if (!context) {
    // Fallback for anything rendered outside the provider (shouldn't happen
    // in practice) so consumers don't need null-checks everywhere.
    return { city: CITIES[0], setCity: () => {} }
  }
  return context
}

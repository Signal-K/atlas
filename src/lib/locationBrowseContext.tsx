import { createContext, useContext, useState, type ReactNode } from 'react'
import { CITIES, type City } from './cities'

interface LocationBrowseValue {
  city: City
  setCity: (city: City) => void
}

const LocationBrowseContext = createContext<LocationBrowseValue | null>(null)

export function LocationBrowseProvider({ defaultCity, children }: { defaultCity: City; children: ReactNode }) {
  // The browse surface always opens at the actual app location. A previously
  // browsed city must not masquerade as the user's location on the next visit.
  const [city, setCityState] = useState<City>(() => defaultCity)

  function setCity(next: City) {
    setCityState(next)
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

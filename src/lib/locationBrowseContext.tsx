import { createContext, useContext, useState, type ReactNode } from 'react'
import { CITIES, type City } from './cities'

interface LocationBrowseValue {
  city: City
  setCity: (city: City) => void
}

const LocationBrowseContext = createContext<LocationBrowseValue | null>(null)

export function LocationBrowseProvider({ defaultCity, children }: { defaultCity: City; children: ReactNode }) {
  const [city, setCity] = useState<City>(defaultCity)
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

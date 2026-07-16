import { useCallback, useMemo, useState } from 'react'
import { CITIES, type City } from './cities'
import type { useLocationSeed } from './geo'

export type LocationSource = 'geolocation' | 'manual' | 'default'

export interface CurrentLocation {
  name: string
  lat: number
  lon: number
  source: LocationSource
}

export const MANUAL_LOCATION_KEY = 'atlas-manual-location'

// Ultimate fallback when the user has neither granted geolocation nor
// picked a manual location -- arbitrary but has to be something, and this
// codebase already has Melbourne-specific content (melbourne-night-sky.mjs).
const DEFAULT_CITY: City = CITIES.find((city) => city.name === 'Melbourne') ?? CITIES[0]

function getManualCity(): City | null {
  const name = localStorage.getItem(MANUAL_LOCATION_KEY)
  if (!name) return null
  return CITIES.find((city) => city.name === name) ?? null
}

export function useCurrentLocation(geo: ReturnType<typeof useLocationSeed>) {
  const [manualCity, setManualCityState] = useState<City | null>(() => getManualCity())

  const setManualLocation = useCallback((city: City | null) => {
    setManualCityState(city)
    if (city) localStorage.setItem(MANUAL_LOCATION_KEY, city.name)
    else localStorage.removeItem(MANUAL_LOCATION_KEY)
  }, [])

  // A manual pick always wins, even once geolocation later resolves --
  // otherwise an explicit correction gets silently reverted on next load
  // (same rationale as locationBrowseContext.tsx's manual-city priority).
  const current = useMemo<CurrentLocation>(() => {
    if (manualCity) return { name: manualCity.name, lat: manualCity.lat, lon: manualCity.lon, source: 'manual' }
    if (geo.coordinates) return { name: 'Your location', lat: geo.coordinates.lat, lon: geo.coordinates.lon, source: 'geolocation' }
    return { name: DEFAULT_CITY.name, lat: DEFAULT_CITY.lat, lon: DEFAULT_CITY.lon, source: 'default' }
  }, [manualCity, geo.coordinates])

  return { current, manualCity, setManualLocation }
}

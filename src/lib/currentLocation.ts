import { useCallback, useEffect, useMemo, useState } from 'react'
import { CITIES, cityLabel, type City } from './cities'
import { reverseGeocodeCity } from './reverseGeocode'
import type { useLocationSeed } from './geo'

export type LocationSource = 'geolocation' | 'manual' | 'default'

export interface CurrentLocation {
  name: string
  lat: number
  lon: number
  source: LocationSource
  timeZone?: string
}

export const MANUAL_LOCATION_KEY = 'atlas-manual-location'

// Ultimate fallback when the user has neither granted geolocation nor
// picked a manual location -- arbitrary but has to be something, and this
// codebase already has Melbourne-specific content (melbourne-night-sky.mjs).
const DEFAULT_CITY: City = CITIES.find((city) => city.name === 'Melbourne') ?? CITIES[0]

function getManualCity(): City | null {
  const stored = localStorage.getItem(MANUAL_LOCATION_KEY)
  if (!stored) return null
  try {
    const parsed = JSON.parse(stored) as City
    if (parsed.name && Number.isFinite(parsed.lat) && Number.isFinite(parsed.lon)) return parsed
  } catch {
    // Legacy installs stored only the curated city name.
  }
  return CITIES.find((city) => city.name === stored) ?? null
}

export function useCurrentLocation(geo: ReturnType<typeof useLocationSeed>) {
  const [manualCity, setManualCityState] = useState<City | null>(() => getManualCity())
  // Reverse-geocoded place name for the current geolocation fix (e.g.
  // "Riga") -- keyed by rounded coordinates so a stale name from a
  // previous fix never gets shown against new coordinates while the
  // lookup for those new coordinates is still in flight.
  const [geoName, setGeoName] = useState<{ key: string; name: string } | null>(null)

  const setManualLocation = useCallback((city: City | null) => {
    setManualCityState(city)
    if (city) localStorage.setItem(MANUAL_LOCATION_KEY, JSON.stringify(city))
    else localStorage.removeItem(MANUAL_LOCATION_KEY)
  }, [])

  useEffect(() => {
    if (manualCity || !geo.coordinates) return
    const { lat, lon } = geo.coordinates
    const key = `${lat},${lon}`
    let cancelled = false
    reverseGeocodeCity(lat, lon).then((name) => {
      if (!cancelled && name) setGeoName({ key, name })
    })
    return () => {
      cancelled = true
    }
  }, [manualCity, geo.coordinates])

  // A manual pick always wins, even once geolocation later resolves --
  // otherwise an explicit correction gets silently reverted on next load
  // (same rationale as locationBrowseContext.tsx's manual-city priority).
  const current = useMemo<CurrentLocation>(() => {
    if (manualCity) return { name: cityLabel(manualCity), lat: manualCity.lat, lon: manualCity.lon, source: 'manual', timeZone: manualCity.timeZone }
    if (geo.coordinates) {
      const key = `${geo.coordinates.lat},${geo.coordinates.lon}`
      const name = geoName?.key === key ? geoName.name : 'Your location'
      return { name, lat: geo.coordinates.lat, lon: geo.coordinates.lon, source: 'geolocation' }
    }
    return { name: DEFAULT_CITY.name, lat: DEFAULT_CITY.lat, lon: DEFAULT_CITY.lon, source: 'default' }
  }, [manualCity, geo.coordinates, geoName])

  return { current, manualCity, setManualLocation }
}

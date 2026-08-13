import { useCallback, useEffect, useMemo, useState } from 'react'
import { CITIES, cityLabel, type City } from './cities'
import { reverseGeocodeCity } from './reverseGeocode'
import type { useLocationSeed } from './geo'
import { activeTripFor, type Trip } from './trips'

export type LocationSource = 'geolocation' | 'manual' | 'default' | 'trip'

export interface CurrentLocation {
  name: string
  lat: number
  lon: number
  source: LocationSource
  timeZone?: string
  // Set when `source` is 'trip' -- lets UI say "back home on <date>" etc.
  trip?: Trip
}

export const MANUAL_LOCATION_KEY = 'atlas-manual-location'

// Permanent (unlike geo.ts's 1-hour location cache) record that this
// visitor has established a real location at least once, either by
// picking one manually or by granting geolocation -- used by App.tsx to
// decide whether someone who clicked past the landing page has actually
// started onboarding, or just clicked "Get started" and left.
export const LOCATION_ESTABLISHED_KEY = 'atlas-location-established'

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
  // An active trip wins over both manual and geolocation while it's live --
  // the whole point is "treat me as if I'm there" for the trip window, not
  // just a suggestion. Re-checked on trip list changes and roughly once a
  // minute so a trip flips on/off without requiring a reload.
  const [trip, setTrip] = useState<Trip | null>(() => activeTripFor())
  // Reverse-geocoded place name for the current geolocation fix (e.g.
  // "Riga") -- keyed by rounded coordinates so a stale name from a
  // previous fix never gets shown against new coordinates while the
  // lookup for those new coordinates is still in flight.
  const [geoName, setGeoName] = useState<{ key: string; name: string } | null>(null)

  const setManualLocation = useCallback((city: City | null) => {
    setManualCityState(city)
    if (city) {
      localStorage.setItem(MANUAL_LOCATION_KEY, JSON.stringify(city))
      localStorage.setItem(LOCATION_ESTABLISHED_KEY, '1')
    } else {
      localStorage.removeItem(MANUAL_LOCATION_KEY)
    }
  }, [])

  useEffect(() => {
    if (manualCity || !geo.coordinates) return
    localStorage.setItem(LOCATION_ESTABLISHED_KEY, '1')
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

  useEffect(() => {
    function refreshTrip() {
      setTrip(activeTripFor())
    }
    refreshTrip()
    window.addEventListener('atlas:trips-changed', refreshTrip)
    const interval = window.setInterval(refreshTrip, 60_000)
    return () => {
      window.removeEventListener('atlas:trips-changed', refreshTrip)
      window.clearInterval(interval)
    }
  }, [])

  // A manual pick always wins, even once geolocation later resolves --
  // otherwise an explicit correction gets silently reverted on next load
  // (same rationale as locationBrowseContext.tsx's manual-city priority).
  // A live trip wins over everything else -- see the trip state comment above.
  const current = useMemo<CurrentLocation>(() => {
    if (trip) return { name: trip.name, lat: trip.lat, lon: trip.lon, source: 'trip', timeZone: trip.timeZone, trip }
    if (manualCity) return { name: cityLabel(manualCity), lat: manualCity.lat, lon: manualCity.lon, source: 'manual', timeZone: manualCity.timeZone }
    if (geo.coordinates) {
      const key = `${geo.coordinates.lat},${geo.coordinates.lon}`
      const name = geoName?.key === key ? geoName.name : 'Your location'
      return { name, lat: geo.coordinates.lat, lon: geo.coordinates.lon, source: 'geolocation' }
    }
    return { name: DEFAULT_CITY.name, lat: DEFAULT_CITY.lat, lon: DEFAULT_CITY.lon, source: 'default' }
  }, [trip, manualCity, geo.coordinates, geoName])

  return { current, manualCity, setManualLocation }
}

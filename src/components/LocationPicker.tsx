import { useEffect, useRef, useState } from 'react'
import { searchLocations } from '../lib/locationSearch'
import { cityLabel, type City } from '../lib/cities'
import { reverseGeocodeCity } from '../lib/reverseGeocode'
import { fetchViewingForecast } from '../lib/weather'
import { trackEvent } from '../lib/analytics'

export function LocationPicker({ onSelect }: { onSelect: (city: City) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<City[]>([])
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [locationError, setLocationError] = useState('')
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => {
    setResults([])
    setSearchError('')
    if (query.trim().length < 2) { setSearching(false); return }
    const controller = new AbortController()
    setSearching(true)
    const timer = window.setTimeout(() => {
      void searchLocations(query, controller.signal).then(cities => {
        if (!controller.signal.aborted) setResults(cities)
      }).catch(() => {
        if (!controller.signal.aborted) setSearchError('City search is unavailable. Check your connection and try again, or use browser location.')
      }).finally(() => { if (!controller.signal.aborted) setSearching(false) })
    }, 300)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query])

  async function requestBrowserLocation() {
    setLocationError('')
    if (!navigator.geolocation || !window.isSecureContext) {
      setLocationError('Browser location is unavailable here. Search for your city instead.')
      return
    }
    setLocating(true)
    try {
      const fix = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }))
      const lat = Number(fix.coords.latitude.toFixed(3)), lon = Number(fix.coords.longitude.toFixed(3))
      const [name, forecast] = await Promise.all([reverseGeocodeCity(lat, lon), fetchViewingForecast(lat, lon, 1).catch(() => null)])
      if (!active.current) return
      trackEvent('Browser location selected', { named: Boolean(name) })
      onSelect({ name: name ?? 'Your current location', lat, lon, timeZone: forecast?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone })
    } catch (error) {
      if (!active.current) return
      const code = (error as GeolocationPositionError).code
      setLocationError(code === 1 ? 'Location access was denied. Allow location in your browser settings, or search for a city.' : code === 3 ? 'Location took too long. Try again, or search for a city.' : 'Your browser could not find your location. Try again, or search for a city.')
    } finally { if (active.current) setLocating(false) }
  }

  return <div className="location-picker"><button type="button" className="browser-location-button" onClick={() => void requestBrowserLocation()} disabled={locating}>{locating ? 'Finding your location…' : 'Use browser location'}</button><p className="data-note">Your browser will ask permission. You can also search cities and towns worldwide.</p>{locationError && <p role="alert" className="location-error">{locationError}</p>}<label className="city-search-label" htmlFor="city-search">Search worldwide</label><input id="city-search" type="search" autoComplete="off" placeholder="City or town name" value={query} onChange={event => setQuery(event.target.value)} aria-controls="city-search-results" aria-describedby="city-search-status" /><p id="city-search-status" role="status" className="data-note">{searching ? 'Searching worldwide…' : searchError || (query.trim().length < 2 ? 'Enter at least two characters.' : results.length ? `${results.length} places found. Region and country distinguish matching names.` : 'No matching places. Try another spelling.')}</p><ul id="city-search-results" className="city-list">{results.map(city => <li key={`${city.name}:${city.lat}:${city.lon}`}><button type="button" onClick={() => { trackEvent('City search result selected', { has_timezone: Boolean(city.timeZone) }); onSelect(city) }}>{cityLabel(city)}</button></li>)}</ul><small className="source-credit">City search: Open-Meteo / GeoNames · Location naming: BigDataCloud</small></div>
}

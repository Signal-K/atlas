import { useEffect, useState } from 'react'
import type { LocationStatus } from '../lib/geo'
import { cityLabel, type City } from '../lib/cities'
import type { CurrentLocation } from '../lib/currentLocation'
import { LocationSearchInput } from './LocationSearchInput'
import { trackEvent } from '../lib/analytics'

interface LocationSettingsProps {
  locationStatus: LocationStatus
  requestLocation: () => void
  currentLocation: CurrentLocation
  manualCity: City | null
  setManualLocation: (city: City | null) => void
  needsMotionPermission: boolean
  requestMotionPermission: () => void
}

const LOCATION_LABEL: Record<LocationStatus, string> = {
  idle: 'Not yet requested',
  pending: 'Requesting…',
  granted: 'Enabled',
  denied: 'Blocked by browser',
  unsupported: 'Not supported on this device',
}

const SOURCE_LABEL: Record<CurrentLocation['source'], string> = {
  geolocation: 'from your browser’s location',
  manual: 'set manually',
  default: 'default — no location set yet',
  trip: 'set by an active trip',
}

export function LocationSettings({
  locationStatus,
  requestLocation,
  currentLocation,
  manualCity,
  setManualLocation,
  needsMotionPermission,
  requestMotionPermission,
}: LocationSettingsProps) {
  const [locationQuery, setLocationQuery] = useState(() => manualCity ? cityLabel(manualCity) : '')
  // ASV-35: clicking "Use current location" used to clear the manual pick
  // immediately, before the GPS fix actually resolved. If geolocation then
  // failed or was denied, the user was left with neither a manual city nor
  // a coordinate -- currentLocation.ts falls through to the hardcoded
  // Melbourne default in that case, silently overwriting a location that
  // was working fine. Now we wait for the request to actually succeed
  // before dropping the manual pick, and surface a message (keeping the
  // old location) if it fails instead.
  const [switchingToGeo, setSwitchingToGeo] = useState(false)
  const [geoSwitchError, setGeoSwitchError] = useState<string | null>(null)

  useEffect(() => {
    if (!switchingToGeo) return
    if (locationStatus === 'granted') {
      setManualLocation(null)
      setLocationQuery('')
      setGeoSwitchError(null)
      setSwitchingToGeo(false)
    } else if (locationStatus === 'denied' || locationStatus === 'unsupported') {
      setGeoSwitchError(
        locationStatus === 'unsupported'
          ? "This device doesn't support location — search for your city instead."
          : "Couldn't get your location — check permissions, or search for your city instead.",
      )
      setSwitchingToGeo(false)
    }
  }, [switchingToGeo, locationStatus, setManualLocation])

  const locationStatusClass =
    locationStatus === 'granted'
      ? 'settings-status--positive'
      : locationStatus === 'denied'
        ? 'settings-status--warning'
        : ''

  return (
    <>
      <div className="settings-row">
        <span className="settings-label">Location-based sky</span>
        <div className="settings-choice">
          <span className={`settings-status ${locationStatusClass}`}>{LOCATION_LABEL[locationStatus]}</span>
          {(locationStatus === 'idle' || locationStatus === 'denied' || locationStatus === 'pending') && (
            <button
              type="button"
              onClick={() => {
                trackEvent('Location permission requested', { source: 'settings', priorStatus: locationStatus })
                requestLocation()
              }}
            >
              {locationStatus === 'denied' ? 'Retry' : 'Enable'}
            </button>
          )}
        </div>
      </div>

      <div className="settings-row">
        <div>
          <span className="settings-label">Your location</span>
          <p className="settings-help">
            Currently <strong>{currentLocation.name}</strong> ({SOURCE_LABEL[currentLocation.source]}). Your location is
            only stored on this device — we don't see it, and it's only ever sent from your own browser directly to
            the weather/astronomy services used to build tonight's plan, and (when using your device's location) a
            reverse-geocoding lookup used only to show its place name.
          </p>
        </div>
        <div className="settings-choice settings-location-choice">
          <LocationSearchInput
            id="settings-location"
            value={locationQuery}
            onChange={setLocationQuery}
            onSelect={(city) => {
              setManualLocation(city)
              setLocationQuery(cityLabel(city))
              trackEvent('Location changed', { source: 'settings', city: city.name, country: city.country, timeZone: city.timeZone })
            }}
            placeholder="Search city, region, or country"
          />
          {manualCity && (
            <button
              type="button"
              disabled={switchingToGeo}
              onClick={() => {
                setGeoSwitchError(null)
                setSwitchingToGeo(true)
                requestLocation()
                trackEvent('Location permission requested', { source: 'settings', priorStatus: locationStatus })
                trackEvent('Location changed', { source: 'settings', method: 'browser_geolocation' })
              }}
            >
              {switchingToGeo ? 'Locating…' : 'Use current location'}
            </button>
          )}
          {geoSwitchError && <p className="settings-help settings-help--warning">{geoSwitchError}</p>}
        </div>
      </div>

      <div className="settings-row">
        <span className="settings-label">Motion parallax</span>
        <div className="settings-choice">
          <span className={`settings-status ${needsMotionPermission ? 'settings-status--warning' : 'settings-status--positive'}`}>
            {needsMotionPermission ? 'Not yet enabled' : 'Enabled / not required on this device'}
          </span>
          {needsMotionPermission && (
            <button type="button" onClick={requestMotionPermission}>
              Enable
            </button>
          )}
        </div>
      </div>
    </>
  )
}

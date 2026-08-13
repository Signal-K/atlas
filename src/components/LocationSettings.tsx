import { useState } from 'react'
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
            <button type="button" onClick={requestLocation}>
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
              onClick={() => {
                setManualLocation(null)
                setLocationQuery('')
                requestLocation()
                trackEvent('Location changed', { source: 'settings', method: 'browser_geolocation' })
              }}
            >
              Use current location
            </button>
          )}
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

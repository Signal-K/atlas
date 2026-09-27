import { Sheet } from './Sheet'
import { LocationSettings } from '../LocationSettings'
import type { LocationStatus } from '../../lib/geo'
import type { City } from '../../lib/cities'
import type { CurrentLocation } from '../../lib/currentLocation'

// Shared "Observing location" sheet -- opened from the TopBar's location
// chip on every screen, and from Profile's "Location & sensors" row. Wraps
// the existing LocationSettings logic (geolocation permission, manual city
// search, motion parallax) rather than re-implementing it.
export function LocationSheet({
  open,
  onClose,
  locationStatus,
  requestLocation,
  currentLocation,
  manualCity,
  setManualLocation,
  needsMotionPermission,
  requestMotionPermission,
}: {
  open: boolean
  onClose: () => void
  locationStatus: LocationStatus
  requestLocation: () => void
  currentLocation: CurrentLocation
  manualCity: City | null
  setManualLocation: (city: City | null) => void
  needsMotionPermission: boolean
  requestMotionPermission: () => void
}) {
  return (
    <Sheet open={open} title="Observing location" onClose={onClose}>
      <p className="az-muted" style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem' }}>
        Sky Pass lets you browse and plan for any location. Your own location stays available offline.
      </p>
      <LocationSettings
        locationStatus={locationStatus}
        requestLocation={requestLocation}
        currentLocation={currentLocation}
        manualCity={manualCity}
        setManualLocation={setManualLocation}
        needsMotionPermission={needsMotionPermission}
        requestMotionPermission={requestMotionPermission}
      />
    </Sheet>
  )
}

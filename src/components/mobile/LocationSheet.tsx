import { Sheet } from './Sheet'
import { LocationSettings } from '../LocationSettings'
import type { LocationStatus } from '../../lib/geo'
import type { City } from '../../lib/cities'
import type { CurrentLocation } from '../../lib/currentLocation'

// Shared "Observing location" sheet -- opened from the TopBar's location
// chip on every screen, and from Profile's "Location & sensors" row. Wraps
// the existing LocationSettings logic (geolocation permission, manual city
// search) rather than re-implementing it.
export function LocationSheet({
  open,
  onClose,
  locationStatus,
  requestLocation,
  currentLocation,
  manualCity,
  setManualLocation,
}: {
  open: boolean
  onClose: () => void
  locationStatus: LocationStatus
  requestLocation: () => void
  currentLocation: CurrentLocation
  manualCity: City | null
  setManualLocation: (city: City | null) => void
}) {
  return (
    <Sheet open={open} title="Observing location" onClose={onClose}>
      <LocationSettings
        locationStatus={locationStatus}
        requestLocation={requestLocation}
        currentLocation={currentLocation}
        manualCity={manualCity}
        setManualLocation={setManualLocation}
        onCitySelected={onClose}
      />
    </Sheet>
  )
}

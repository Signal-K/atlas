import { useLocationSeed } from '../lib/geo'
import { useCurrentLocation } from '../lib/currentLocation'

/**
 * Bootstraps the app's location seed + resolved current location.
 * Extracted from App.tsx so the app shell is routing/layout only.
 */
export function useAppLocation() {
  // Location is intentionally user-initiated. Re-requesting it as each PWA
  // session mounts makes Safari/macOS repeatedly show the OS permission
  // prompt, even for someone who has already chosen a location. Onboarding
  // and Settings both expose an explicit action when a fresh position is
  // wanted; the durable cache supplies the usual return journey.
  const location = useLocationSeed({
    autoRequest: false,
  })

  const { current: currentLocation, manualCity, setManualLocation } = useCurrentLocation(location)

  return { location, currentLocation, manualCity, setManualLocation }
}

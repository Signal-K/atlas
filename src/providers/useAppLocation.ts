import { useLocationSeed } from '../lib/geo'
import { MANUAL_LOCATION_KEY, useCurrentLocation } from '../lib/currentLocation'

interface UseAppLocationArgs {
  isAppRoute: boolean
  hasClickedIntoApp: boolean
  onboardingFlowDismissed: boolean
}

/**
 * Bootstraps the app's location seed + resolved current location.
 * Extracted from App.tsx so the app shell is routing/layout only; behavior
 * is unchanged.
 */
export function useAppLocation({ isAppRoute, hasClickedIntoApp, onboardingFlowDismissed }: UseAppLocationArgs) {
  const hasManualLocation = localStorage.getItem(MANUAL_LOCATION_KEY) != null

  // Deferred until onboarding is out of the way: a first-time visitor who
  // just clicked "Get started" on the landing page shouldn't immediately
  // get an OS geolocation permission popup before they've even seen
  // OnboardingFlow's own "location" step (which offers the same "use my
  // current location" option, deliberately). Once onboarding is done
  // (finished or skipped) this reverts to the original behavior for anyone
  // who still hasn't set a location.
  const location = useLocationSeed({
    autoRequest: isAppRoute && hasClickedIntoApp && !hasManualLocation && onboardingFlowDismissed,
  })

  const { current: currentLocation, manualCity, setManualLocation } = useCurrentLocation(location)

  // Remounts location-dependent views once per real location change (a GPS
  // fix arriving, or a manual pick) without thrashing on every minor GPS
  // jitter -- rounded coordinates match the ~11km stability window
  // useLocationSeed already uses.
  const locationKey = `${currentLocation.source}:${currentLocation.lat.toFixed(1)},${currentLocation.lon.toFixed(1)}`

  return { location, currentLocation, manualCity, setManualLocation, locationKey }
}

import { useState, type ReactNode } from 'react'
import { SkyMapOverlay } from '../SkyMapOverlay'
import { bodyForTarget, getHorizontalPosition } from '../../lib/skyPosition'
import { useDeviceCompass } from '../../lib/deviceCompass'
import type { CurrentLocation } from '../../lib/currentLocation'
import type { SkyEvent } from '../../lib/db'

// "Point" on an event's detail sheet opens the existing sky-map/compass
// overlay aimed at that event's body -- only offered when the event maps to
// a real trackable body (bodyForTarget returns null for meteor showers,
// guides, etc., which have no single point to aim at).
export function useEventPointing(city: CurrentLocation): {
  pointActionFor: (event: SkyEvent) => { onPoint: () => void } | undefined
  overlay: ReactNode
} {
  const [target, setTarget] = useState<SkyEvent | null>(null)
  const compass = useDeviceCompass()

  function pointActionFor(event: SkyEvent) {
    if (!bodyForTarget(event.kind, event.target)) return undefined
    return { onPoint: () => setTarget(event) }
  }

  const body = target ? bodyForTarget(target.kind, target.target) : null
  const overlay =
    target && body ? (
      <SkyMapOverlay
        cityName={city.name}
        clarity={70}
        lat={city.lat}
        lon={city.lon}
        targetLabel={target.title}
        targetPosition={getHorizontalPosition(body, new Date(), city.lat, city.lon)}
        compassStatus={compass.status}
        pointing={compass.pointing}
        onEnableCompass={compass.enable}
        onClose={() => setTarget(null)}
      />
    ) : null

  return { pointActionFor, overlay }
}

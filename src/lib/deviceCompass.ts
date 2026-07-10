import { useCallback, useEffect, useState } from 'react'

export type CompassStatus = 'idle' | 'unsupported' | 'denied' | 'active'

interface WebkitDeviceOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number
}

// iOS Safari gates orientation access behind a user-gesture permission
// prompt; other browsers expose it directly. Heading is degrees clockwise
// from true north, matching the azimuth convention astronomy-engine uses.
export function useDeviceCompass() {
  const [status, setStatus] = useState<CompassStatus>('idle')
  const [headingDeg, setHeadingDeg] = useState<number | null>(null)

  useEffect(() => {
    if (status !== 'active') return

    function handleOrientation(event: WebkitDeviceOrientationEvent) {
      // webkitCompassHeading (iOS) is already a true-north compass heading.
      // Standard `alpha` is relative to the device's start orientation, not
      // compass heading, but it's the best cross-browser fallback available.
      const heading = event.webkitCompassHeading ?? (event.alpha != null ? 360 - event.alpha : null)
      if (heading != null) setHeadingDeg(heading)
    }

    window.addEventListener('deviceorientation', handleOrientation)
    return () => window.removeEventListener('deviceorientation', handleOrientation)
  }, [status])

  const enable = useCallback(async () => {
    const DeviceOrientationEventCtor = window.DeviceOrientationEvent as unknown as
      | { requestPermission?: () => Promise<'granted' | 'denied'> }
      | undefined
    if (!DeviceOrientationEventCtor) {
      setStatus('unsupported')
      return
    }
    if (typeof DeviceOrientationEventCtor.requestPermission === 'function') {
      try {
        const result = await DeviceOrientationEventCtor.requestPermission()
        setStatus(result === 'granted' ? 'active' : 'denied')
      } catch {
        setStatus('denied')
      }
      return
    }
    // Android/other browsers don't gate this behind a permission prompt.
    setStatus('active')
  }, [])

  return { status, headingDeg, enable }
}

export function turnInstruction(headingDeg: number, targetAzimuthDeg: number): string {
  const delta = (((targetAzimuthDeg - headingDeg + 180) % 360) + 360) % 360 - 180
  if (Math.abs(delta) < 8) return 'Pointing at it'
  return `Turn ${Math.round(Math.abs(delta))}° ${delta > 0 ? 'right' : 'left'}`
}

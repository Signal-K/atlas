import { useCallback, useEffect, useRef, useState } from 'react'

export interface ParallaxOffset {
  x: number
  y: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

interface OrientationPermissionAPI {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

// Drives background parallax from the device's accelerometer/gyroscope
// (via DeviceOrientationEvent) where available, falling back to mouse
// position on desktop. targetRef/currentRef are refs (not state) so the
// animation loop can read them every frame without triggering re-renders.
export function useParallax() {
  const targetRef = useRef<ParallaxOffset>({ x: 0, y: 0 })
  const [needsMotionPermission, setNeedsMotionPermission] = useState(false)

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    const gamma = event.gamma ?? 0 // left-right tilt, -90..90
    const beta = event.beta ?? 0 // front-back tilt, -180..180
    targetRef.current = {
      x: clamp(gamma / 45, -1, 1),
      y: clamp((beta - 45) / 45, -1, 1),
    }
  }, [])

  const handleMouse = useCallback((event: MouseEvent) => {
    targetRef.current = {
      x: (event.clientX / window.innerWidth) * 2 - 1,
      y: (event.clientY / window.innerHeight) * 2 - 1,
    }
  }, [])

  useEffect(() => {
    const orientationCtor = (window as unknown as { DeviceOrientationEvent?: OrientationPermissionAPI })
      .DeviceOrientationEvent

    if (orientationCtor && typeof orientationCtor.requestPermission === 'function') {
      setNeedsMotionPermission(true)
    } else if ('DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation)
    }

    window.addEventListener('mousemove', handleMouse)

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation)
      window.removeEventListener('mousemove', handleMouse)
    }
  }, [handleOrientation, handleMouse])

  const requestMotionPermission = useCallback(async () => {
    const orientationCtor = (window as unknown as { DeviceOrientationEvent?: OrientationPermissionAPI })
      .DeviceOrientationEvent
    try {
      const result = await orientationCtor?.requestPermission?.()
      if (result === 'granted') {
        window.addEventListener('deviceorientation', handleOrientation)
        setNeedsMotionPermission(false)
      }
    } catch {
      // Motion permission dismissed or unsupported — parallax stays mouse-only.
    }
  }, [handleOrientation])

  return { targetRef, needsMotionPermission, requestMotionPermission }
}

import { useCallback, useEffect, useState } from 'react'
import { hashSeed } from './rng'

const DEFAULT_SEED = hashSeed('atlas-default-sky')

export type LocationStatus = 'idle' | 'pending' | 'granted' | 'denied' | 'unsupported'

// Rounding to ~1 decimal degree (~11km) keeps the field stable across small
// movements and avoids regenerating on every minor GPS jitter.
export function useLocationSeed() {
  const [seed, setSeed] = useState(DEFAULT_SEED)
  const [status, setStatus] = useState<LocationStatus>('idle')

  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported')
      return
    }
    setStatus('pending')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(1)
        const lon = position.coords.longitude.toFixed(1)
        setSeed(hashSeed(`${lat},${lon}`))
        setStatus('granted')
      },
      () => {
        setStatus('denied')
      },
      { timeout: 8000, maximumAge: 3_600_000 },
    )
  }, [])

  useEffect(() => {
    requestLocation()
  }, [requestLocation])

  return { seed, status, requestLocation }
}

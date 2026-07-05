import { useEffect, useState } from 'react'
import { hashSeed } from './rng'

const DEFAULT_SEED = hashSeed('atlas-default-sky')

// Rounding to ~1 decimal degree (~11km) keeps the field stable across small
// movements and avoids regenerating on every minor GPS jitter.
export function useLocationSeed(): number {
  const [seed, setSeed] = useState(DEFAULT_SEED)

  useEffect(() => {
    if (!('geolocation' in navigator)) return

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(1)
        const lon = position.coords.longitude.toFixed(1)
        setSeed(hashSeed(`${lat},${lon}`))
      },
      () => {
        // Permission denied or unavailable — keep the default seed.
      },
      { timeout: 8000, maximumAge: 3_600_000 },
    )
  }, [])

  return seed
}

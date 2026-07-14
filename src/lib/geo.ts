import { useCallback, useEffect, useRef, useState } from 'react'
import { hashSeed } from './rng'

const DEFAULT_SEED = hashSeed('atlas-default-sky')

export type LocationStatus = 'idle' | 'pending' | 'granted' | 'denied' | 'unsupported'

export interface Coordinates {
  lat: number
  lon: number
}

const CACHE_KEY = 'atlas-location-cache'
// Matches the maximumAge passed to getCurrentPosition below: within this
// window we trust a cached fix instead of re-asking the browser, since a
// fresh getCurrentPosition() call re-triggers the OS-level location prompt
// on every page load/reload even when permission was already granted --
// most visibly on macOS, where the prompt caps "remember" at one day and
// otherwise reappears on every mount of this hook.
const CACHE_TTL_MS = 3_600_000

interface CachedFix {
  lat: number
  lon: number
  cachedAt: number
}

function readCache(): CachedFix | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedFix
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

function writeCache(fix: CachedFix) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(fix))
  } catch {
    // Best-effort; a failed cache write just means the next mount re-asks.
  }
}

// Rounding to ~1 decimal degree (~11km) keeps the field stable across small
// movements and avoids regenerating on every minor GPS jitter.
export function useLocationSeed() {
  const cached = readCache()
  const [seed, setSeed] = useState(cached ? hashSeed(`${cached.lat},${cached.lon}`) : DEFAULT_SEED)
  const [status, setStatus] = useState<LocationStatus>(cached ? 'granted' : 'idle')
  const [coordinates, setCoordinates] = useState<Coordinates | null>(cached ? { lat: cached.lat, lon: cached.lon } : null)
  // Guards against firing getCurrentPosition() twice concurrently -- e.g.
  // React StrictMode's dev-only double-invoke of effects (mount -> cleanup
  // -> mount again), which would otherwise stack two native OS location
  // prompts on top of each other. Dismissing the visible one just reveals
  // an identical second one underneath, which reads as "won't dismiss."
  const requestInFlight = useRef(false)

  const requestLocation = useCallback((force = false) => {
    if (!force) {
      const fresh = readCache()
      if (fresh) {
        setSeed(hashSeed(`${fresh.lat},${fresh.lon}`))
        setCoordinates({ lat: fresh.lat, lon: fresh.lon })
        setStatus('granted')
        return
      }
    }
    if (!('geolocation' in navigator)) {
      setStatus('unsupported')
      return
    }
    if (requestInFlight.current) return
    requestInFlight.current = true
    setStatus('pending')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        requestInFlight.current = false
        const lat = Number(position.coords.latitude.toFixed(1))
        const lon = Number(position.coords.longitude.toFixed(1))
        writeCache({ lat, lon, cachedAt: Date.now() })
        setSeed(hashSeed(`${lat},${lon}`))
        setCoordinates({ lat, lon })
        setStatus('granted')
      },
      () => {
        requestInFlight.current = false
        setStatus('denied')
      },
      { timeout: 8000, maximumAge: 3_600_000 },
    )
  }, [])

  useEffect(() => {
    requestLocation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // `requestLocation(true)` forces a fresh browser prompt (e.g. a "Retry"
  // button after a denial) bypassing the cache.
  return { seed, status, coordinates, requestLocation }
}

import { useCallback, useEffect, useRef, useState } from 'react'

export type LocationStatus = 'idle' | 'pending' | 'granted' | 'denied' | 'unsupported'

export interface Coordinates {
  lat: number
  lon: number
}

const CACHE_KEY = 'atlas:locationCache'
// Matches the maximumAge passed to getCurrentPosition below: within this
// window we trust a cached fix instead of re-asking the browser, since a
// fresh getCurrentPosition() call re-triggers the OS-level location prompt
// on every page load/reload even when permission was already granted --
// most visibly on macOS, where the prompt caps "remember" at one day and
// otherwise reappears on every mount of this hook.
const CACHE_TTL_MS = 3_600_000

interface CachedFix extends Coordinates {
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

// Rounding to ~1 decimal degree (~11km) keeps the cached fix stable across
// small movements and avoids re-prompting on every minor GPS jitter.
export function useLocation({ autoRequest = true }: { autoRequest?: boolean } = {}) {
  const cached = readCache()
  const [status, setStatus] = useState<LocationStatus>(cached ? 'granted' : 'idle')
  const [coordinates, setCoordinates] = useState<Coordinates | null>(cached ? { lat: cached.lat, lon: cached.lon } : null)
  // Guards against firing getCurrentPosition() twice concurrently -- e.g.
  // React StrictMode's dev-only double-invoke of effects -- which would
  // otherwise stack two native OS location prompts on top of each other.
  const requestInFlight = useRef(false)

  const requestLocation = useCallback((force = false) => {
    if (!force) {
      const fresh = readCache()
      if (fresh) {
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
        setCoordinates({ lat, lon })
        setStatus('granted')
      },
      () => {
        requestInFlight.current = false
        setStatus('denied')
      },
      { timeout: 8000, maximumAge: CACHE_TTL_MS },
    )
  }, [])

  useEffect(() => {
    if (!autoRequest) return
    requestLocation()
  }, [autoRequest, requestLocation])

  return { status, coordinates, requestLocation }
}

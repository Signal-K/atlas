// Turns raw geolocation coordinates into a real place name (e.g. "Riga")
// instead of the generic "Your location" placeholder currentLocation.ts
// used to hardcode for every geolocation-sourced fix. BigDataCloud's
// client-side reverse-geocode endpoint is free, keyless, and CORS-enabled
// -- no backend/API key wiring needed.
const CACHE_KEY = 'atlas-reverse-geocode-cache'
const CACHE_TTL_MS = 24 * 3_600_000

interface CachedEntry {
  name: string
  cachedAt: number
}

function cacheKeyFor(lat: number, lon: number): string {
  // Matches geo.ts's ~1 decimal degree (~11km) rounding, so a cache hit is
  // shared with the same fix that fed the coordinates in.
  return `${lat.toFixed(1)},${lon.toFixed(1)}`
}

function readCache(lat: number, lon: number): string | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const all = JSON.parse(raw) as Record<string, CachedEntry>
    const entry = all[cacheKeyFor(lat, lon)]
    if (!entry || Date.now() - entry.cachedAt > CACHE_TTL_MS) return null
    return entry.name
  } catch {
    return null
  }
}

function writeCache(lat: number, lon: number, name: string) {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const all = raw ? (JSON.parse(raw) as Record<string, CachedEntry>) : {}
    all[cacheKeyFor(lat, lon)] = { name, cachedAt: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(all))
  } catch {
    // Best-effort; a failed cache write just means the next call re-fetches.
  }
}

interface ReverseGeocodeResponse {
  city?: string
  locality?: string
  principalSubdivision?: string
  countryName?: string
}

// Returns null on any failure (offline, API down) -- callers should fall
// back to a generic label rather than block on this.
export async function reverseGeocodeCity(lat: number, lon: number): Promise<string | null> {
  const cached = readCache(lat, lon)
  if (cached) return cached

  const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('localityLanguage', 'en')

  try {
    // Bounded: this comment already promised callers a fast fallback rather
    // than a block, but without a timeout a hung request never rejects for
    // the catch below to act on -- it just sits pending until the browser's
    // own TCP timeout, stalling every page that waits on the resolved
    // location name (which is most of them, on first load).
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!response.ok) return null
    const data = (await response.json()) as ReverseGeocodeResponse
    const name = data.city || data.locality || data.principalSubdivision || null
    if (name) writeCache(lat, lon, name)
    return name
  } catch {
    return null
  }
}

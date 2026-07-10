// Client-side altitude/azimuth for identifiable bodies (AT epic 1 decision
// doc: computed on-demand per observer lat/lon rather than precomputed at
// ingest, since most SkyEvents aren't tied to any one location and a
// traveller's real position won't match a fixed city list).
import * as Astronomy from 'astronomy-engine'

export interface HorizontalPosition {
  altitudeDeg: number
  azimuthDeg: number
  compassLabel: string
}

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export function azimuthToCompass(azimuthDeg: number): string {
  const index = Math.round(azimuthDeg / 45) % 8
  return COMPASS_POINTS[(index + 8) % 8]
}

// Maps a SkyEvent's target string to an astronomy-engine Body, where
// identifiable. planet_event targets are already lowercase body names
// (see scripts/sources/planets.mjs); moon_phase targets are always 'moon'.
// Everything else (iss_pass, conjunction, meteor_shower, eclipse, deep_sky)
// isn't a single point body astronomy-engine can look up, so returns null.
export function bodyForTarget(kind: string, target: string): Astronomy.Body | null {
  if (kind === 'moon_phase') return Astronomy.Body.Moon
  if (kind === 'planet_event') {
    const name = target.charAt(0).toUpperCase() + target.slice(1)
    return name in Astronomy.Body ? Astronomy.Body[name as keyof typeof Astronomy.Body] : null
  }
  return null
}

// Rounds inputs to cache-friendly buckets (~1km position, 1-minute time) so
// repeated lookups for the same target within a render pass hit the cache
// instead of re-running the ephemeris — position barely moves minute to
// minute for anything in this app's target list.
const positionCache = new Map<string, HorizontalPosition>()

export function getHorizontalPosition(body: Astronomy.Body, date: Date, lat: number, lon: number): HorizontalPosition {
  const key = `${body}:${lat.toFixed(2)}:${lon.toFixed(2)}:${Math.floor(date.getTime() / 60_000)}`
  const cached = positionCache.get(key)
  if (cached) return cached

  const observer = new Astronomy.Observer(lat, lon, 0)
  const equator = Astronomy.Equator(body, date, observer, true, true)
  const horizontal = Astronomy.Horizon(date, observer, equator.ra, equator.dec, 'normal')

  const result: HorizontalPosition = {
    altitudeDeg: horizontal.altitude,
    azimuthDeg: horizontal.azimuth,
    compassLabel: azimuthToCompass(horizontal.azimuth),
  }
  positionCache.set(key, result)
  return result
}

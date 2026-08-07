import { haversineKm } from './cities'
import type { SkyEvent } from './db'

// Raised from 120: the curated CITIES list (cities.ts) is sparse enough
// that a meaningful fraction of real user locations sit 120-200km from
// their nearest entry, silently dropping every location-bound event
// (ISS/satellite passes) for them even though a nearby city's pass is
// still a perfectly good naked-eye match at that distance.
const LOCAL_EVENT_RADIUS_KM = 200
const MAX_ISS_PASSES = 1

// PocketBase's NumberField has no nullable option, so any ingest plugin that
// omits latitude/longitude (every globally-visible kind: eclipses, meteor
// showers, aurora, comets, conjunctions, moon phases) gets stored as (0, 0)
// rather than null. Treating that as a real coordinate silently confines
// those events to a 200km radius around Null Island (Gulf of Guinea) and
// hides them from every real user location, so it's treated as "unset" too.
function hasNoRealLocation(event: SkyEvent): boolean {
  return (
    event.latitude == null ||
    event.longitude == null ||
    (event.latitude === 0 && event.longitude === 0)
  )
}

export function isLocalEvent(event: SkyEvent, lat: number, lon: number): boolean {
  if (hasNoRealLocation(event)) return true
  return haversineKm({ lat, lon }, { lat: event.latitude!, lon: event.longitude! }) <= LOCAL_EVENT_RADIUS_KM
}

export function localEventDistanceKm(event: SkyEvent, lat: number, lon: number): number | null {
  if (hasNoRealLocation(event)) return null
  return haversineKm({ lat, lon }, { lat: event.latitude!, lon: event.longitude! })
}

export function diversifyEvents(events: SkyEvent[], limit = 6): SkyEvent[] {
  const sorted = [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const selected: SkyEvent[] = []
  const kindCounts = new Map<string, number>()

  for (const event of sorted) {
    const count = kindCounts.get(event.kind) ?? 0
    if (event.kind === 'iss_pass' && count >= MAX_ISS_PASSES) continue
    if (count >= 2) continue
    selected.push(event)
    kindCounts.set(event.kind, count + 1)
    if (selected.length >= limit) break
  }

  return selected
}

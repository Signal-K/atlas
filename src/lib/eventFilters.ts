import { haversineKm } from './cities'
import type { SkyEvent } from './db'

// Raised from 120: the curated CITIES list (cities.ts) is sparse enough
// that a meaningful fraction of real user locations sit 120-200km from
// their nearest entry, silently dropping every location-bound event
// (ISS/satellite passes) for them even though a nearby city's pass is
// still a perfectly good naked-eye match at that distance.
const LOCAL_EVENT_RADIUS_KM = 200
const MAX_ISS_PASSES = 1

export function isLocalEvent(event: SkyEvent, lat: number, lon: number): boolean {
  if (event.latitude == null || event.longitude == null) return true
  return haversineKm({ lat, lon }, { lat: event.latitude, lon: event.longitude }) <= LOCAL_EVENT_RADIUS_KM
}

// Genuinely location-agnostic (moon phases, meteor showers, eclipses,
// conjunctions, aurora/space-weather) as opposed to ISS/satellite passes,
// which only mean anything for a specific viewer -- see sync.ts's note on
// why (0,0) is normalized to undefined rather than treated as a real
// coordinate. Used by the premium global feed, which should never show a
// pass time that's wrong for whoever's actually reading it.
export function isGlobalEvent(event: SkyEvent): boolean {
  return event.latitude == null && event.longitude == null
}

export function localEventDistanceKm(event: SkyEvent, lat: number, lon: number): number | null {
  if (event.latitude == null || event.longitude == null) return null
  return haversineKm({ lat, lon }, { lat: event.latitude, lon: event.longitude })
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

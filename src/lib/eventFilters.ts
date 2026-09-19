import type { SkyEvent } from './db'
import { isVisibleFromLocation } from './eventVisibility.mjs'
// The geographic half of "is this event mine" moved to eventGeo.mjs so the
// past-check-in matcher can reuse it under plain `node --test` -- it cannot
// import this file, whose extensionless imports Node will not resolve. The
// definitions are unchanged and re-exported below, so no caller changed.
import { isLocalEvent, localEventDistanceKm } from './eventGeo.mjs'

export { isLocalEvent, localEventDistanceKm }

const MAX_ISS_PASSES = 1

/** Includes both geographic matching and the observer-time visibility gate. */
export function isVisibleLocalEvent(event: SkyEvent, lat: number, lon: number): boolean {
  return isLocalEvent(event, lat, lon) && isVisibleFromLocation(event, lat, lon)
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

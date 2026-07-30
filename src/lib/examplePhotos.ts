import { haversineKm } from './cities'
import { GUIDE_KIND_IDS } from './eventCategories'
import type { Discovery } from './discoveries'
import type { SkyEvent } from './db'

// Sky photos of the same target look broadly similar across a wide region
// (same object, same rough light-pollution band) -- this doesn't need to be
// a tight radius the way "is this ISS pass visible from here" does.
const NEARBY_RADIUS_KM = 300

export interface ExamplePhotoMatch extends Discovery {
  distanceKm: number | null
}

function targetsMatch(discovery: Discovery, event: SkyEvent): boolean {
  const target = discovery.target?.toLowerCase().trim()
  if (!target) return false
  return event.title.toLowerCase().includes(target) || event.target.toLowerCase().includes(target)
}

// Picks real, nearby community photos for an event: prefer an exact target
// match, and for "nothing special happening" filler nights (the recurring
// Guides kinds), fall back to any nearby photo at all -- a "here's what a
// good ordinary night looks like near you" example rather than requiring an
// exact match that filler events can never have. Returns nothing (never a
// fabricated fallback image) when there's no real candidate.
export function matchExamplePhotos(
  discoveries: Discovery[],
  event: SkyEvent,
  city: { lat: number; lon: number },
  limit = 1,
): ExamplePhotoMatch[] {
  const withPhotos = discoveries.filter((discovery) => discovery.imageUrl)

  const withDistance = withPhotos.map((discovery) => ({
    discovery,
    distanceKm:
      discovery.latitude != null && discovery.longitude != null
        ? haversineKm(city, { lat: discovery.latitude, lon: discovery.longitude })
        : null,
  }))

  const nearby = withDistance.filter(({ distanceKm }) => distanceKm == null || distanceKm <= NEARBY_RADIUS_KM)

  const targeted = nearby
    .filter(({ discovery }) => targetsMatch(discovery, event))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))

  if (targeted.length > 0) {
    return targeted.slice(0, limit).map(({ discovery, distanceKm }) => ({ ...discovery, distanceKm }))
  }

  if (GUIDE_KIND_IDS.has(event.kind)) {
    const anyNearby = nearby.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
    return anyNearby.slice(0, limit).map(({ discovery, distanceKm }) => ({ ...discovery, distanceKm }))
  }

  return []
}

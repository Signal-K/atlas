// Where an event is, and whether it is near enough to a given observer to
// count as theirs.
//
// These four functions used to live in cities.ts and eventFilters.ts as
// TypeScript. They are plain .mjs here for one concrete reason: the
// past-check-in matcher (pastCheckInMatch.mjs) has to run under `node --test`,
// and Node's type stripping does not resolve the extensionless imports those
// .ts modules use (`./cities`, `./db`). Moving the geography out to .mjs lets
// the ranker be tested directly instead of being tested through a bundler
// nobody runs in CI.
//
// cities.ts and eventFilters.ts re-export everything here verbatim, so no
// caller changed and there is still exactly one definition of each.

// Raised from 120: the curated CITIES list (cities.ts) is sparse enough
// that a meaningful fraction of real user locations sit 120-200km from
// their nearest entry, silently dropping every location-bound event
// (ISS/satellite passes) for them even though a nearby city's pass is
// still a perfectly good naked-eye match at that distance.
export const LOCAL_EVENT_RADIUS_KM = 200

export function haversineKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// PocketBase's NumberField has no nullable option, so any ingest plugin that
// omits latitude/longitude (every globally-visible kind: eclipses, meteor
// showers, aurora, comets, conjunctions, moon phases) gets stored as (0, 0)
// rather than null. Treating that as a real coordinate silently confines
// those events to a 200km radius around Null Island (Gulf of Guinea) and
// hides them from every real user location, so it's treated as "unset" too.
export function hasNoRealLocation(event) {
  return (
    event.latitude == null ||
    event.longitude == null ||
    (event.latitude === 0 && event.longitude === 0)
  )
}

export function isLocalEvent(event, lat, lon) {
  if (hasNoRealLocation(event)) return true
  return haversineKm({ lat, lon }, { lat: event.latitude, lon: event.longitude }) <= LOCAL_EVENT_RADIUS_KM
}

export function localEventDistanceKm(event, lat, lon) {
  if (hasNoRealLocation(event)) return null
  return haversineKm({ lat, lon }, { lat: event.latitude, lon: event.longitude })
}

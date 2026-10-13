// City search has to survive two geocoders that disagree about a shared name.
// The curated list's Zurich is 47.38, 8.54 in Switzerland. Open-Meteo also
// returns Zurich, Kansas. A result that carries the Swiss coordinates and the
// Kansas label (or the reverse, when the curated row has no country yet) was
// stored as "Zurich, Kansas, United States". Coordinates win when they sit on
// a known city in a different country.
import { haversineKm } from './eventGeo.mjs'

export const SAME_PLACE_KM = 40

export function reconcilePlace(city, curatedCities) {
  let nearest = null
  let nearestKm = Infinity
  for (const known of curatedCities) {
    const km = haversineKm(known, city)
    if (km < nearestKm) {
      nearest = known
      nearestKm = km
    }
  }
  if (!nearest || nearestKm > SAME_PLACE_KM) return { ...city }

  const countryConflicts = Boolean(city.country && nearest.country && city.country !== nearest.country)
  if (countryConflicts) {
    return {
      ...nearest,
      lat: city.lat,
      lon: city.lon,
    }
  }

  return {
    ...city,
    name: city.name || nearest.name,
    admin1: city.admin1 || nearest.admin1,
    country: city.country || nearest.country,
    timeZone: city.timeZone || nearest.timeZone,
  }
}

export function mergeLocationResults(query, curatedCities, remote) {
  const normalized = query.trim().toLocaleLowerCase()
  const curated = curatedCities.filter((city) => {
    const haystack = [city.name, city.admin1, city.country].filter(Boolean).join(' ').toLocaleLowerCase()
    return haystack.includes(normalized)
  })
  const rankedRemote = [...remote].sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
  const merged = []

  for (const city of [...curated, ...rankedRemote]) {
    const place = reconcilePlace(city, curatedCities)
    const duplicate = merged.find(
      (existing) =>
        existing.name.toLocaleLowerCase() === place.name.toLocaleLowerCase() && haversineKm(existing, place) < SAME_PLACE_KM,
    )
    if (duplicate) continue
    merged.push(place)
  }

  return merged.slice(0, 8)
}

// Dark-sky trip planner (STS-172). Deliberately separate from
// localOps.ts/LocalOpsView.tsx, which are an unrelated local PocketBase
// diagnostics dashboard -- not touched by this feature.
//
// Site data: a curated static dataset of well-known real-world dark-sky
// sites with their approximate Bortle scale rating, rather than a live
// light-pollution API integration. There is no confirmed API/credentials
// for a live light-pollution service in this project yet (e.g. a
// lightpollutionmap.info API key) -- swap `DARK_SKY_SITES` for a live fetch
// once one is chosen, without changing the ranking/routing logic below.
import { CITIES, haversineKm } from './cities'

export interface DarkSkySite {
  id: string
  name: string
  lat: number
  lon: number
  bortleClass: number // 1 (darkest) to 9 (inner-city)
  notes: string
}

export const DARK_SKY_SITES: DarkSkySite[] = [
  { id: 'lake-tekapo', name: 'Lake Tekapo / Aoraki Mackenzie Dark Sky Reserve', lat: -44.0055, lon: 170.4794, bortleClass: 1, notes: 'Gold-tier International Dark Sky Reserve, Southern Hemisphere.' },
  { id: 'atacama', name: 'Atacama Desert (San Pedro de Atacama)', lat: -22.9098, lon: -68.1997, bortleClass: 1, notes: 'Among the driest, darkest skies on Earth; home to major observatories.' },
  { id: 'nambung', name: 'Nambung National Park, WA', lat: -30.6167, lon: 115.1167, bortleClass: 2, notes: 'Remote coastal desert, minimal light dome from Perth.' },
  { id: 'warrumbungle', name: 'Warrumbungle National Park, NSW', lat: -31.2833, lon: 149.0, bortleClass: 2, notes: "Australia's first Dark Sky Park." },
  { id: 'kielder', name: 'Kielder Water & Forest Park', lat: 55.2278, lon: -2.5722, bortleClass: 2, notes: 'UK Dark Sky Park in Northumberland.' },
  { id: 'brecon-beacons', name: 'Brecon Beacons National Park', lat: 51.8833, lon: -3.4333, bortleClass: 3, notes: 'Accessible Dark Sky Reserve in Wales.' },
  { id: 'korema', name: 'Kõrvemaa Landscape Protection Area', lat: 59.279, lon: 25.554, bortleClass: 4, notes: 'Rural forest and wetland landscape east of Tallinn.' },
  { id: 'lahemaa', name: 'Lahemaa National Park', lat: 59.512, lon: 25.885, bortleClass: 4, notes: 'Rural coastal sky north-east of Tallinn.' },
  { id: 'lerderderg', name: 'Lerderderg State Park', lat: -37.55, lon: 144.35, bortleClass: 4, notes: 'Rural observing area within an easy drive of Melbourne.' },
  { id: 'death-valley', name: 'Death Valley National Park', lat: 36.5054, lon: -117.0794, bortleClass: 2, notes: 'Gold-tier Dark Sky Park, US.' },
  { id: 'cherry-springs', name: 'Cherry Springs State Park, PA', lat: 41.6631, lon: -77.8258, bortleClass: 2, notes: 'One of the darkest sites in the Eastern US.' },
  { id: 'namibrand', name: 'NamibRand Nature Reserve', lat: -25.0, lon: 16.0, bortleClass: 1, notes: 'Gold-tier reserve, Namibia.' },
  { id: 'mont-megantic', name: 'Mont-Mégantic International Dark Sky Reserve', lat: 45.4553, lon: -71.1517, bortleClass: 2, notes: 'First International Dark Sky Reserve, Quebec.' },
]

export interface RankedDarkSkySite extends DarkSkySite {
  distanceKm: number
  estimatedTravelMinutes: number
  lightPollutionDelta?: number
}

export interface LightPollutionEstimate {
  bortleClass: number
  label: string
  skyQualityScore: 1 | 2 | 3 | 4 | 5
  skyQualityLabel: string
  skyQuality: 'urban' | 'suburban' | 'rural' | 'dark'
  confidence: 'estimated' | 'curated-site'
  nearestCityName: string
  nearestCityDistanceKm: number
}

// Rough average speed assumption for a driving trip (no live routing
// service integrated yet) -- good enough for an estimated travel time, not
// turn-by-turn directions.
const ASSUMED_AVG_SPEED_KMH = 70

// Plain-language caption for the Bortle scale itself -- "Bortle 4" means
// nothing to most users without this.
export function bortleExplainer(bortleClass: number): string {
  return `Bortle scale ${bortleClass} of 9 (1 = darkest sky, 9 = brightest) — how much light pollution washes out faint stars.`
}

// Atlas uses a deliberately simple five-point scale in the UI. Bortle is
// retained as an internal source value so the catalog can stay compatible
// with astronomy data, but it should never be the first thing a visitor has
// to decode.
export function skyQualityScore(bortleClass: number): 1 | 2 | 3 | 4 | 5 {
  if (bortleClass <= 2) return 5
  if (bortleClass <= 4) return 4
  if (bortleClass <= 6) return 3
  if (bortleClass <= 8) return 2
  return 1
}

export function skyQualityLabelForScore(score: 1 | 2 | 3 | 4 | 5): string {
  if (score === 5) return 'Very dark'
  if (score === 4) return 'Dark'
  if (score === 3) return 'Some glow'
  if (score === 2) return 'Bright'
  return 'City glow'
}

export function lightPollutionLabel(bortleClass: number): string {
  if (bortleClass <= 2) return 'dark-sky site'
  if (bortleClass <= 4) return 'rural sky'
  if (bortleClass <= 6) return 'suburban sky'
  if (bortleClass <= 8) return 'urban sky'
  return 'inner-city sky'
}

function skyQualityForBortle(bortleClass: number): LightPollutionEstimate['skyQuality'] {
  if (bortleClass <= 2) return 'dark'
  if (bortleClass <= 4) return 'rural'
  if (bortleClass <= 6) return 'suburban'
  return 'urban'
}

function nearestCuratedDarkSite(lat: number, lon: number) {
  return DARK_SKY_SITES.map((site) => ({ ...site, distanceKm: haversineKm({ lat, lon }, site) })).sort(
    (a, b) => a.distanceKm - b.distanceKm,
  )[0]
}

function estimateBortleFromCityDistance(distanceKm: number): number {
  if (distanceKm < 10) return 8
  if (distanceKm < 25) return 7
  if (distanceKm < 50) return 6
  if (distanceKm < 100) return 5
  if (distanceKm < 175) return 4
  return 3
}

export function estimateLightPollution(lat: number, lon: number): LightPollutionEstimate {
  const nearestCity = CITIES.map((city) => ({ ...city, distanceKm: haversineKm(city, { lat, lon }) })).sort(
    (a, b) => a.distanceKm - b.distanceKm,
  )[0]
  const nearestDarkSite = nearestCuratedDarkSite(lat, lon)

  if (nearestDarkSite && nearestDarkSite.distanceKm <= 15) {
    const score = skyQualityScore(nearestDarkSite.bortleClass)
    return {
      bortleClass: nearestDarkSite.bortleClass,
      label: lightPollutionLabel(nearestDarkSite.bortleClass),
      skyQualityScore: score,
      skyQualityLabel: skyQualityLabelForScore(score),
      skyQuality: skyQualityForBortle(nearestDarkSite.bortleClass),
      confidence: 'curated-site',
      nearestCityName: nearestCity?.name ?? 'Unknown city',
      nearestCityDistanceKm: nearestCity?.distanceKm ?? 0,
    }
  }

  const cityDistance = nearestCity?.distanceKm ?? 250
  const cityBasedBortle = estimateBortleFromCityDistance(cityDistance)
  const bortleClass =
    nearestDarkSite && nearestDarkSite.distanceKm < 60 ? Math.min(cityBasedBortle, nearestDarkSite.bortleClass + 1) : cityBasedBortle

  return {
    bortleClass,
    label: lightPollutionLabel(bortleClass),
    skyQualityScore: skyQualityScore(bortleClass),
    skyQualityLabel: skyQualityLabelForScore(skyQualityScore(bortleClass)),
    skyQuality: skyQualityForBortle(bortleClass),
    confidence: 'estimated',
    nearestCityName: nearestCity?.name ?? 'Unknown city',
    nearestCityDistanceKm: cityDistance,
  }
}

export function rankDarkSkySites(lat: number, lon: number, limit = 5): RankedDarkSkySite[] {
  return DARK_SKY_SITES.map((site) => {
    const distanceKm = haversineKm({ lat, lon }, site)
    return {
      ...site,
      distanceKm,
      estimatedTravelMinutes: Math.round((distanceKm / ASSUMED_AVG_SPEED_KMH) * 60),
    }
  })
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
}

export function rankLowerLightPollutionSites(lat: number, lon: number, limit = 5): RankedDarkSkySite[] {
  const current = estimateLightPollution(lat, lon)
  const rankedSites = rankDarkSkySites(lat, lon, DARK_SKY_SITES.length)
    .map((site) => ({
      ...site,
      lightPollutionDelta: current.bortleClass - site.bortleClass,
    }))

  const lowerPollutionSites = rankedSites.filter((site) => (site.lightPollutionDelta ?? 0) > 0)
  return (lowerPollutionSites.length > 0 ? lowerPollutionSites : rankedSites)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
}

// Deep-links to the device's native maps app for turn-by-turn directions
// (v1 scope per the AC) rather than an in-app routing engine.
export function directionsUrl(
  site: DarkSkySite,
  origin?: { lat: number; lon: number },
  mode: 'driving' | 'transit' = 'driving',
): string {
  const params = new URLSearchParams({
    api: '1',
    destination: `${site.lat},${site.lon}`,
    travelmode: mode,
  })
  if (origin) params.set('origin', `${origin.lat},${origin.lon}`)
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

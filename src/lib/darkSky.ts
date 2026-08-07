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
  // Oceania
  { id: 'lake-tekapo', name: 'Lake Tekapo / Aoraki Mackenzie Dark Sky Reserve', lat: -44.0055, lon: 170.4794, bortleClass: 1, notes: 'Gold-tier International Dark Sky Reserve, Southern Hemisphere.' },
  { id: 'stewart-island', name: 'Stewart Island / Rakiura Dark Sky Sanctuary', lat: -46.9833, lon: 168.1333, bortleClass: 1, notes: "New Zealand's first Dark Sky Sanctuary." },
  { id: 'great-barrier-island', name: 'Great Barrier Island Dark Sky Sanctuary', lat: -36.1833, lon: 175.4167, bortleClass: 2, notes: 'Dark Sky Sanctuary a short ferry/flight from Auckland.' },
  { id: 'nambung', name: 'Nambung National Park, WA', lat: -30.6167, lon: 115.1167, bortleClass: 2, notes: 'Remote coastal desert, minimal light dome from Perth.' },
  { id: 'warrumbungle', name: 'Warrumbungle National Park, NSW', lat: -31.2833, lon: 149.0, bortleClass: 2, notes: "Australia's first Dark Sky Park." },
  { id: 'lerderderg', name: 'Lerderderg State Park', lat: -37.55, lon: 144.35, bortleClass: 4, notes: 'Rural observing area within an easy drive of Melbourne.' },
  { id: 'blue-mountains', name: 'Blue Mountains (Jenolan area), NSW', lat: -33.8167, lon: 150.0167, bortleClass: 4, notes: 'Closest reliably rural sky within reach of Sydney.' },
  { id: 'river-murray', name: 'River Murray Dark Sky Park, SA', lat: -34.5, lon: 139.9, bortleClass: 3, notes: 'Dark Sky Park along the Murray, within reach of Adelaide.' },
  { id: 'wairarapa', name: 'Wairarapa (Aorangi Range), NZ', lat: -41.25, lon: 175.4, bortleClass: 3, notes: 'Rural dark sky over the ranges from Wellington.' },
  // South America
  { id: 'atacama', name: 'Atacama Desert (San Pedro de Atacama)', lat: -22.9098, lon: -68.1997, bortleClass: 1, notes: 'Among the driest, darkest skies on Earth; home to major observatories.' },
  { id: 'elqui-valley', name: 'Elqui Valley Dark Sky Sanctuary', lat: -30.1667, lon: -70.5, bortleClass: 1, notes: 'Gold-tier sanctuary in Chile, near several public observatories.' },
  { id: 'sierra-la-ventana', name: 'Sierra de la Ventana, Buenos Aires Province', lat: -38.15, lon: -61.8, bortleClass: 3, notes: 'Rural range sky within reach of Buenos Aires.' },
  { id: 'villa-de-leyva', name: 'Villa de Leyva highlands', lat: 5.6333, lon: -73.5333, bortleClass: 3, notes: 'High-altitude rural sky within reach of Bogotá.' },
  { id: 'nazca', name: 'Nazca / Ica desert', lat: -14.8333, lon: -75.1, bortleClass: 2, notes: 'Coastal desert sky within reach of Lima.' },
  // North America
  { id: 'death-valley', name: 'Death Valley National Park', lat: 36.5054, lon: -117.0794, bortleClass: 2, notes: 'Gold-tier Dark Sky Park, US.' },
  { id: 'joshua-tree', name: 'Joshua Tree National Park', lat: 33.8734, lon: -115.901, bortleClass: 2, notes: 'Dark Sky Park within reach of Los Angeles / San Diego.' },
  { id: 'anza-borrego', name: 'Anza-Borrego Desert State Park', lat: 33.2585, lon: -116.4, bortleClass: 2, notes: 'International Dark Sky Park, Southern California desert.' },
  { id: 'cherry-springs', name: 'Cherry Springs State Park, PA', lat: 41.6631, lon: -77.8258, bortleClass: 2, notes: 'One of the darkest sites in the Eastern US.' },
  { id: 'katahdin-woods', name: 'Katahdin Woods and Waters, ME', lat: 45.9, lon: -68.85, bortleClass: 2, notes: 'Dark Sky Sanctuary in northern New England, reachable from Boston.' },
  { id: 'headlands-mi', name: 'Headlands International Dark Sky Park, MI', lat: 45.7756, lon: -84.7669, bortleClass: 2, notes: 'Dark Sky Park at the top of the Michigan mitten.' },
  { id: 'great-basin', name: 'Great Basin National Park, NV', lat: 39.0058, lon: -114.2161, bortleClass: 1, notes: 'One of the darkest parks in the continental US.' },
  { id: 'big-bend', name: 'Big Bend National Park, TX', lat: 29.25, lon: -103.25, bortleClass: 1, notes: 'Darkest measured sky of any US national park, near Houston/Austin.' },
  { id: 'enchanted-rock', name: 'Enchanted Rock State Natural Area, TX', lat: 30.5069, lon: -98.8189, bortleClass: 3, notes: 'Dark Sky Sanctuary within a few hours of Houston.' },
  { id: 'chaco-culture', name: 'Chaco Culture National Historical Park, NM', lat: 36.0608, lon: -107.9558, bortleClass: 2, notes: 'Remote Dark Sky Park in the high desert, within reach of Denver.' },
  { id: 'central-idaho', name: 'Central Idaho Dark Sky Reserve', lat: 44.2, lon: -114.9, bortleClass: 1, notes: "First Dark Sky Reserve in the US, near Sun Valley."},
  { id: 'point-reyes', name: 'Point Reyes National Seashore', lat: 38.0678, lon: -122.8067, bortleClass: 3, notes: 'Rural coastal sky within an easy drive of San Francisco.' },
  { id: 'olympic-np', name: 'Olympic National Park, WA', lat: 47.8021, lon: -123.6044, bortleClass: 3, notes: 'Rural coastal/mountain sky within reach of Seattle.' },
  { id: 'staunton-sp', name: 'Staunton State Park, CO', lat: 39.4547, lon: -105.3572, bortleClass: 3, notes: 'Dark Sky Park in the foothills within reach of Denver.' },
  { id: 'cypress-hills', name: 'Cypress Hills Interprovincial Park', lat: 49.65, lon: -110.0, bortleClass: 2, notes: 'Dark Sky Preserve on the Alberta/Saskatchewan border.' },
  { id: 'mont-megantic', name: 'Mont-Mégantic International Dark Sky Reserve', lat: 45.4553, lon: -71.1517, bortleClass: 2, notes: 'First International Dark Sky Reserve, Quebec.' },
  { id: 'torrance-barrens', name: 'Torrance Barrens Dark Sky Preserve', lat: 44.95, lon: -79.35, bortleClass: 2, notes: "Ontario's first Dark Sky Preserve, within reach of Toronto." },
  { id: 'gulf-islands', name: 'Gulf Islands (Saturna Island), BC', lat: 48.7833, lon: -123.2, bortleClass: 3, notes: 'Dark Sky Preserve within a ferry ride of Vancouver.' },
  // Europe
  { id: 'kielder', name: 'Kielder Water & Forest Park', lat: 55.2278, lon: -2.5722, bortleClass: 2, notes: 'UK Dark Sky Park in Northumberland.' },
  { id: 'brecon-beacons', name: 'Brecon Beacons National Park', lat: 51.8833, lon: -3.4333, bortleClass: 3, notes: 'Accessible Dark Sky Reserve in Wales.' },
  { id: 'exmoor', name: 'Exmoor National Park', lat: 51.15, lon: -3.65, bortleClass: 3, notes: "Europe's first Dark Sky Reserve, within reach of London/Bristol." },
  { id: 'kerry', name: 'Kerry International Dark Sky Reserve', lat: 51.8333, lon: -10.2167, bortleClass: 2, notes: 'Gold-tier reserve on the Iveragh Peninsula, within reach of Dublin/Cork.' },
  { id: 'westhavelland', name: 'Westhavelland Nature Park', lat: 52.7167, lon: 12.35, bortleClass: 3, notes: 'Star Park an hour from Berlin.' },
  { id: 'eifel-np', name: 'Eifel National Park', lat: 50.5, lon: 6.4167, bortleClass: 3, notes: 'Dark Sky Park within reach of the Rhine-Ruhr region.' },
  { id: 'rhoen', name: 'Rhön Biosphere Reserve Star Park', lat: 50.45, lon: 10.0, bortleClass: 3, notes: 'Star Park central to several German cities.' },
  { id: 'lauwersmeer', name: 'Lauwersmeer National Park', lat: 53.35, lon: 6.25, bortleClass: 3, notes: 'Dark Sky Park in the Netherlands, within reach of Amsterdam.' },
  { id: 'cevennes', name: 'Cévennes International Dark Sky Reserve', lat: 44.25, lon: 3.6, bortleClass: 2, notes: 'Large reserve in southern France.' },
  { id: 'pic-du-midi', name: 'Pic du Midi Dark Sky Reserve', lat: 42.9369, lon: 0.1411, bortleClass: 2, notes: 'Pyrenees reserve around a working observatory.' },
  { id: 'gredos', name: 'Sierra de Gredos Starlight Reserve', lat: 40.25, lon: -5.25, bortleClass: 2, notes: 'Starlight Reserve within reach of Madrid.' },
  { id: 'extremadura', name: 'Extremadura Starlight Reserve', lat: 39.5, lon: -6.0, bortleClass: 1, notes: 'Very dark rural reserve in western Spain.' },
  { id: 'alqueva', name: 'Alqueva Dark Sky Reserve', lat: 38.2, lon: -7.5, bortleClass: 2, notes: 'Dark Sky Reserve within reach of Lisbon.' },
  { id: 'colle-est-cesio', name: 'Alpi Marittime area', lat: 44.15, lon: 7.4, bortleClass: 3, notes: 'Rural alpine sky within reach of northern Italy.' },
  { id: 'gran-sasso', name: 'Gran Sasso e Monti della Laga', lat: 42.45, lon: 13.55, bortleClass: 2, notes: 'Dark mountain sky within reach of Rome.' },
  { id: 'grossmugl', name: 'Grossmugl Star Park', lat: 48.4167, lon: 16.35, bortleClass: 3, notes: 'Star Park within reach of Vienna.' },
  { id: 'zselic', name: 'Zselic Starry Sky Park', lat: 46.25, lon: 17.75, bortleClass: 3, notes: 'Starry Sky Park within reach of Budapest.' },
  { id: 'bieszczady', name: 'Bieszczady Dark Sky Park', lat: 49.15, lon: 22.6, bortleClass: 2, notes: 'One of the darkest skies in Central Europe.' },
  { id: 'izera', name: 'Izera Dark Sky Park', lat: 50.85, lon: 15.35, bortleClass: 3, notes: 'Dark Sky Park spanning the Polish-Czech border.' },
  { id: 'korema', name: 'Kõrvemaa Landscape Protection Area', lat: 59.279, lon: 25.554, bortleClass: 4, notes: 'Rural forest and wetland landscape east of Tallinn.' },
  { id: 'lahemaa', name: 'Lahemaa National Park', lat: 59.512, lon: 25.885, bortleClass: 4, notes: 'Rural coastal sky north-east of Tallinn.' },
  { id: 'soomaa', name: 'Soomaa National Park', lat: 58.45, lon: 25.15, bortleClass: 4, notes: 'Rural wetland sky in southern Estonia.' },
  { id: 'gauja', name: 'Gauja National Park', lat: 57.2, lon: 25.0, bortleClass: 4, notes: 'Rural forested sky within reach of Riga.' },
  { id: 'labanoras', name: 'Labanoras Regional Park', lat: 55.3, lon: 25.75, bortleClass: 4, notes: 'Rural sky within reach of Vilnius.' },
  { id: 'bialowieza', name: 'Białowieża Forest', lat: 52.7, lon: 23.85, bortleClass: 3, notes: 'Ancient forest sky within reach of Warsaw.' },
  { id: 'sjaelso', name: 'North Zealand rural sky', lat: 56.0, lon: 12.2, bortleClass: 4, notes: 'Rural coastal sky within reach of Copenhagen.' },
  { id: 'blafjoll', name: 'Þingvellir National Park', lat: 64.2558, lon: -21.1297, bortleClass: 2, notes: 'UNESCO site and dark sky area within reach of Reykjavik.' },
  { id: 'nuuksio', name: 'Nuuksio National Park', lat: 60.3, lon: 24.5667, bortleClass: 3, notes: 'Rural forest sky within reach of Helsinki.' },
  { id: 'femundsmarka', name: 'Femundsmarka National Park', lat: 62.15, lon: 12.15, bortleClass: 2, notes: 'Norway Dark Sky Park within reach of Oslo.' },
  { id: 'tyresta', name: 'Tyresta National Park', lat: 59.15, lon: 18.35, bortleClass: 3, notes: 'Rural forest sky within reach of Stockholm.' },
  { id: 'zeus-parnitha', name: 'Mount Parnitha National Park', lat: 38.15, lon: 23.75, bortleClass: 3, notes: 'Rural mountain sky within reach of Athens.' },
  { id: 'yedigoller', name: 'Yedigöller National Park', lat: 40.85, lon: 31.6, bortleClass: 3, notes: 'Rural forest sky within reach of Istanbul.' },
  { id: 'prioksko-terrasny', name: 'Prioksko-Terrasny Nature Reserve', lat: 54.9, lon: 37.5667, bortleClass: 4, notes: 'Rural reserve sky within reach of Moscow.' },
  // Africa & Middle East
  { id: 'namibrand', name: 'NamibRand Nature Reserve', lat: -25.0, lon: 16.0, bortleClass: 1, notes: 'Gold-tier reserve, Namibia.' },
  { id: 'sutherland', name: 'Sutherland / Karoo (SAAO site)', lat: -32.3833, lon: 20.8104, bortleClass: 1, notes: 'Home to the South African Astronomical Observatory; very dark Karoo sky.' },
  { id: 'cederberg', name: 'Cederberg Wilderness Area', lat: -32.3833, lon: 19.05, bortleClass: 2, notes: 'Dark mountain sky within reach of Cape Town.' },
  { id: 'ramon-crater', name: 'Mitzpe Ramon / Ramon Crater', lat: 30.6094, lon: 34.8014, bortleClass: 1, notes: 'Israeli Dark Sky Park in the Negev, within reach of Tel Aviv.' },
  { id: 'al-marmoom', name: 'Al Marmoom Desert Conservation Reserve', lat: 24.8167, lon: 55.35, bortleClass: 3, notes: 'Protected desert sky within reach of Dubai.' },
  { id: 'edom-mountains', name: 'Wadi Rum-adjacent desert (Jordan border area)', lat: 29.55, lon: 35.4167, bortleClass: 1, notes: 'Remote desert sky near the Jordanian border.' },
  { id: 'siwa', name: 'Siwa Oasis', lat: 29.2, lon: 25.5194, bortleClass: 2, notes: 'Remote Western Desert oasis, far from Cairo light domes.' },
  { id: 'ngong-hills', name: 'Ngong Hills rural sky', lat: -1.4, lon: 36.6167, bortleClass: 3, notes: 'Rural highland sky within reach of Nairobi.' },
  // Asia
  { id: 'hanle', name: 'Hanle Dark Sky Reserve, Ladakh', lat: 32.7794, lon: 78.9642, bortleClass: 1, notes: "India's first Dark Sky Reserve, high-altitude and very dark." },
  { id: 'nubra-valley', name: 'Nubra Valley', lat: 34.6833, lon: 77.5667, bortleClass: 2, notes: 'High-altitude Himalayan valley sky within reach of Ladakh.' },
  { id: 'iriomote', name: 'Iriomote-Ishigaki National Park', lat: 24.35, lon: 123.8, bortleClass: 1, notes: 'Dark Sky Park in Okinawa, one of the darkest skies in Japan.' },
  { id: 'oshu-mizusawa', name: 'Rural Iwate countryside', lat: 39.15, lon: 141.15, bortleClass: 3, notes: 'Rural sky within reach of Tokyo/Sendai by rail.' },
  { id: 'yeongyang', name: 'Yeongyang Firefly Eco Park', lat: 36.6667, lon: 129.1167, bortleClass: 2, notes: "Asia's first Dark Sky Park, within reach of Seoul/Daegu." },
  { id: 'alxa-desert', name: 'Alxa Desert (Inner Mongolia)', lat: 39.0, lon: 105.5, bortleClass: 1, notes: 'Remote desert sky within reach of Beijing by rail.' },
  { id: 'khao-yai', name: 'Khao Yai National Park', lat: 14.4333, lon: 101.3667, bortleClass: 3, notes: 'Rural forest sky within reach of Bangkok.' },
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

// Rough average speed used only to provide a coarse proximity estimate. This
// is straight-line distance, not routing data; UI copy must not call it an
// actual drive time.
const ASSUMED_AVG_SPEED_KMH = 70

// A "trip" recommendation is intended to be local/regional, not a flight --
// so anything past this coarse proximity threshold is excluded at the source (rankDarkSkySites
// and rankLowerLightPollutionSites) rather than left to each caller to filter.
// Without this baked in, a sparse region can fall through to the single
// globally-nearest site regardless of continent (e.g. suggesting a US park
// to someone in Estonia).
export const MAX_QUICK_TRIP_MINUTES = 240

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
    .filter((site) => site.estimatedTravelMinutes <= MAX_QUICK_TRIP_MINUTES)
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

// Shared by the desktop DarkSkyView and mobile DarkSitesPanel so both
// surfaces describe a ranked site the same way instead of each keeping its
// own copy of the same bortleClass/delta ternary (they'd already drifted
// into different casing before this existed).
export function tripSiteQualityLabel(bortleClass: number): string {
  const score = skyQualityScore(bortleClass)
  return `${score}/5 · ${skyQualityLabelForScore(score)}`
}

export function tripComparisonNote(lightPollutionDelta: number | undefined): string {
  return (lightPollutionDelta ?? 0) > 0 ? 'darker sky than home' : 'best known match'
}

export function formatTripDriveTime(estimatedTravelMinutes: number): string {
  if (estimatedTravelMinutes < 60) return `roughly ${estimatedTravelMinutes} min away`
  return `roughly ${Math.floor(estimatedTravelMinutes / 60)}h ${estimatedTravelMinutes % 60}m away`
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

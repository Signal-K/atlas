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
import { haversineKm } from './cities'

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
  { id: 'death-valley', name: 'Death Valley National Park', lat: 36.5054, lon: -117.0794, bortleClass: 2, notes: 'Gold-tier Dark Sky Park, US.' },
  { id: 'cherry-springs', name: 'Cherry Springs State Park, PA', lat: 41.6631, lon: -77.8258, bortleClass: 2, notes: 'One of the darkest sites in the Eastern US.' },
  { id: 'namibrand', name: 'NamibRand Nature Reserve', lat: -25.0, lon: 16.0, bortleClass: 1, notes: 'Gold-tier reserve, Namibia.' },
  { id: 'mont-megantic', name: 'Mont-Mégantic International Dark Sky Reserve', lat: 45.4553, lon: -71.1517, bortleClass: 2, notes: 'First International Dark Sky Reserve, Quebec.' },
]

export interface RankedDarkSkySite extends DarkSkySite {
  distanceKm: number
  estimatedTravelMinutes: number
}

// Rough average speed assumption for a driving trip (no live routing
// service integrated yet) -- good enough for an estimated travel time, not
// turn-by-turn directions.
const ASSUMED_AVG_SPEED_KMH = 70

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

// Deep-links to the device's native maps app for turn-by-turn directions
// (v1 scope per the AC) rather than an in-app routing engine.
export function directionsUrl(site: DarkSkySite): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${site.lat},${site.lon}`
}

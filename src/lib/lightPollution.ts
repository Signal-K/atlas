import { pb } from './pocketbase'

// atlas_light_pollution_samples (see pocketbase/migrations/
// 20260720113000_atlas_light_pollution_and_city_stamps.js) has no ingest
// source wired up yet -- this reads whatever's there today and degrades to
// `null` for unmapped locations rather than fabricating a reading.
interface LightPollutionSample {
  latitude: number
  longitude: number
  bortle_class: number
  sqm_mag_arcsec2?: number
  confidence: 'estimated' | 'modelled' | 'measured'
}

export interface LightPollutionReading {
  bortleClass: number
  sqmMagArcsec2?: number
  confidence: 'estimated' | 'modelled' | 'measured'
  distanceKm: number
  description: string
  whatYouCanSee: string
}

// Bortle scale (Clark, 2001): a 1-9 naked-eye sky-darkness ladder. Phrased
// for what a first-time stargazer would actually notice, not the formal
// astronomical definitions (which lean on terms like "zodiacal light").
const BORTLE_SCALE: Array<{ description: string; whatYouCanSee: string }> = [
  { description: 'Excellent dark sky', whatYouCanSee: 'The Milky Way casts visible shadows; thousands of stars are visible to the naked eye.' },
  { description: 'Truly dark sky', whatYouCanSee: 'The Milky Way is richly structured and obvious overhead; airglow may be visible near the horizon.' },
  { description: 'Rural sky', whatYouCanSee: 'The Milky Way still shows plenty of structure; light domes are faint and low on the horizon.' },
  { description: 'Rural/suburban transition', whatYouCanSee: 'The Milky Way is visible but washes out near the horizon; light domes are noticeable in a few directions.' },
  { description: 'Suburban sky', whatYouCanSee: 'The Milky Way is only visible overhead on a good night; light domes are visible in most directions.' },
  { description: 'Bright suburban sky', whatYouCanSee: 'The Milky Way is essentially invisible; only the brightest deep-sky objects are worth a look.' },
  { description: 'Suburban/urban transition', whatYouCanSee: 'The sky glows grey-white; only bright stars, planets, and the Moon stand out.' },
  { description: 'City sky', whatYouCanSee: 'The sky is bright; only the Moon, planets, and a handful of the brightest stars are visible.' },
  { description: 'Inner-city sky', whatYouCanSee: 'Only the Moon, planets, and the very brightest stars cut through the glow.' },
]

export function bortleDescription(bortleClass: number): { description: string; whatYouCanSee: string } {
  const index = Math.min(9, Math.max(1, Math.round(bortleClass))) - 1
  return BORTLE_SCALE[index]
}

const EARTH_RADIUS_KM = 6371

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
}

// Samples within a degree or so of the query point are close enough for a
// per-location reading; beyond ~300km a "nearest sample" would be
// misleading (light pollution varies block-to-block near a city edge), so
// treat that as "not mapped here" instead of guessing.
const SEARCH_RADIUS_DEG = 1.5
const MAX_USEFUL_DISTANCE_KM = 300

export async function fetchNearestLightPollution(lat: number, lon: number): Promise<LightPollutionReading | null> {
  try {
    const samples = await pb.collection('atlas_light_pollution_samples').getFullList<LightPollutionSample>({
      filter: `latitude >= ${lat - SEARCH_RADIUS_DEG} && latitude <= ${lat + SEARCH_RADIUS_DEG} && longitude >= ${lon - SEARCH_RADIUS_DEG} && longitude <= ${lon + SEARCH_RADIUS_DEG}`,
      sort: '-sample_date',
    })
    if (samples.length === 0) return null

    let nearest = samples[0]
    let nearestDistance = haversineKm(lat, lon, nearest.latitude, nearest.longitude)
    for (const sample of samples.slice(1)) {
      const distance = haversineKm(lat, lon, sample.latitude, sample.longitude)
      if (distance < nearestDistance) {
        nearest = sample
        nearestDistance = distance
      }
    }
    if (nearestDistance > MAX_USEFUL_DISTANCE_KM) return null

    const { description, whatYouCanSee } = bortleDescription(nearest.bortle_class)
    return {
      bortleClass: nearest.bortle_class,
      sqmMagArcsec2: nearest.sqm_mag_arcsec2,
      confidence: nearest.confidence,
      distanceKm: nearestDistance,
      description,
      whatYouCanSee,
    }
  } catch {
    // Offline, demo mode, or PocketBase unreachable -- treat the same as
    // "not mapped here" rather than surfacing a network error for a
    // secondary panel.
    return null
  }
}

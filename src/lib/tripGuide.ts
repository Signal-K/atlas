import { pb } from './pocketbase'
import type { TripLeg, TripLegGuide } from './tripPlans'
import { estimateLightPollution, rankDarkSkySites } from './darkSky'
import { moonIlluminationPctAt } from './moonPhase'
import { fetchViewingForecast } from './weather'
import { getEventsInRange, pullSkyEvents } from './sync'
import { isLocalEvent } from './eventFilters'
import { categoryForKind } from './eventCategories'
import { localDateKey } from './weather'

// Client for the Sky Pass "personalized trip guide" endpoint
// (pocketbase/pb_hooks/trip-guide.pb.js). That endpoint requires a
// server-side ANTHROPIC_API_KEY and is not enabled on every deployment,
// same pattern as eclipseRoadmap.ts. This is an explicit "Generate guide"
// button tap -- callers should surface the thrown error message rather
// than swallow it.

// A middling Bortle class and moon can still produce a faint band, so "no"
// is reserved for genuinely washed-out skies -- these thresholds match the
// qualitative language tonightTargets.ts already uses for "great for a wide
// starfield or Milky Way shot" (moon low, sky dark), extended with a Bortle
// cutoff since a bright urban sky washes it out regardless of the moon.
export function computeMilkyWayVisibility(bortleClass: number, moonIlluminationPct: number): 'yes' | 'marginal' | 'no' {
  if (bortleClass <= 4 && moonIlluminationPct < 50) return 'yes'
  if (bortleClass <= 6 && moonIlluminationPct < 70) return 'marginal'
  return 'no'
}

interface TripLegSignals {
  bortleClass: number
  skyQualityLabel: string
  moonIlluminationPct: number
  milkyWayVisible: 'yes' | 'marginal' | 'no'
  cloudCoverPct: number | null
  highlights: { title: string; kind: string; date: string }[]
  nearbyDarkSites: { name: string; bortleClass: number; distanceKm: number }[]
}

// Composes existing signals for one leg -- no new astronomy math, this just
// pulls together darkSky.ts (Bortle), moonPhase.ts, weather.ts and the local
// sky-events mirror the same way tonightTargets.ts's getTonightPlan() does
// for a single location.
async function computeTripLegSignals(leg: TripLeg, interests: string[]): Promise<TripLegSignals> {
  const startDate = new Date(`${leg.startDate}T12:00:00`)
  const lightPollution = estimateLightPollution(leg.lat, leg.lon)
  const moonIlluminationPct = moonIlluminationPctAt(startDate)
  const milkyWayVisible = computeMilkyWayVisibility(lightPollution.bortleClass, moonIlluminationPct)

  const forecast = await fetchViewingForecast(leg.lat, leg.lon, 14).catch(() => ({ days: [], timeZone: leg.timeZone }))
  const startKey = localDateKey(startDate.toISOString(), leg.timeZone ?? forecast.timeZone)
  const cloudCoverPct = forecast.days.find((day) => day.date === startKey)?.cloudCoverPct ?? null

  await pullSkyEvents()
  const rangeStart = new Date(`${leg.startDate}T00:00:00`)
  const rangeEnd = new Date(`${leg.endDate}T23:59:59`)
  const events = await getEventsInRange(rangeStart, rangeEnd)
  const highlights = events
    .filter((event) => isLocalEvent(event, leg.lat, leg.lon))
    .filter((event) => interests.length === 0 || interests.includes(categoryForKind(event.kind)?.id ?? ''))
    .slice(0, 10)
    .map((event) => ({ title: event.title, kind: event.kind, date: event.startsAt.slice(0, 10) }))

  const nearbyDarkSites = rankDarkSkySites(leg.lat, leg.lon, 3)
    .filter((site) => site.bortleClass < lightPollution.bortleClass)
    .map((site) => ({ name: site.name, bortleClass: site.bortleClass, distanceKm: site.distanceKm }))

  return {
    bortleClass: lightPollution.bortleClass,
    skyQualityLabel: lightPollution.skyQualityLabel,
    moonIlluminationPct,
    milkyWayVisible,
    cloudCoverPct,
    highlights,
    nearbyDarkSites,
  }
}

export async function requestTripLegGuide(leg: TripLeg, equipment: string[], interests: string[]): Promise<TripLegGuide> {
  if (!pb.authStore.isValid) throw new Error('Sign in to generate a trip guide.')

  const signals = await computeTripLegSignals(leg, interests)

  const result = await pb.send<{ narrative?: string }>('/atlas/trips/guide', {
    method: 'POST',
    // pb.send() only JSON-encodes a plain-object body when Content-Type is
    // explicitly "application/json" -- without this header it hands the
    // object straight to fetch(), which doesn't accept one.
    headers: { 'Content-Type': 'application/json' },
    body: {
      cityName: leg.cityName,
      startDate: leg.startDate,
      endDate: leg.endDate,
      ...signals,
      equipment,
      interests,
    },
  })

  const narrative = result?.narrative
  if (!narrative) throw new Error('Could not generate a trip guide.')

  return {
    bortleClass: signals.bortleClass,
    skyQualityLabel: signals.skyQualityLabel,
    moonIlluminationPct: signals.moonIlluminationPct,
    milkyWayVisible: signals.milkyWayVisible,
    narrative,
    generatedAt: new Date().toISOString(),
  }
}

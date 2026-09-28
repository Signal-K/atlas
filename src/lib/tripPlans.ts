import { pb } from './pocketbase'
import { parsePbDate } from './pocketbaseDate'
import type { City } from './cities'

export const TRIP_MAX_LEGS = 6

export interface TripLeg {
  // A city can occur more than once in a journey (for example, outbound and
  // return stays). City/date is not a durable identity: guides, React rows,
  // and edits must refer to this particular stay rather than the city.
  id: string
  cityKey: string
  cityName: string
  lat: number
  lon: number
  timeZone?: string
  startDate: string // 'YYYY-MM-DD'
  endDate: string
}

export type ViewingInstrumentId = 'naked_eye' | 'binoculars' | 'telescope'

export const VIEWING_INSTRUMENTS: { id: ViewingInstrumentId; label: string }[] = [
  { id: 'naked_eye', label: 'Naked eye' },
  { id: 'binoculars', label: 'Binoculars' },
  { id: 'telescope', label: 'Telescope' },
]

export interface TripLegGuide {
  bortleClass: number
  skyQualityLabel: string
  moonIlluminationPct: number
  milkyWayVisible: 'yes' | 'marginal' | 'no'
  narrative: string
  generatedAt: string
}

export interface TripPlan {
  id: string
  startDate: string
  endDate: string
  legs: TripLeg[]
  // Viewing instruments (VIEWING_INSTRUMENTS ids) plus, optionally, a
  // DeviceId from cameraProfiles.ts for phone-specific photography tips.
  equipment: string[]
  // EVENT_CATEGORIES ids from eventCategories.ts.
  interests: string[]
  guides: Record<string, TripLegGuide> // keyed by TripLeg.id
}

function cityKey(city: City): string {
  return `${city.name}-${city.lat.toFixed(2)}-${city.lon.toFixed(2)}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-')
}

export function makeLeg(city: City, startDate: string, endDate: string): TripLeg {
  return {
    id: `stay-${crypto.randomUUID()}`,
    cityKey: cityKey(city),
    cityName: city.name,
    lat: city.lat,
    lon: city.lon,
    timeZone: city.timeZone,
    startDate,
    endDate,
  }
}

// Date order is a product invariant, not a presentation preference. Keep it
// in one helper so the builder, saved plan, active-location resolver, and
// planner summary cannot diverge when stops were added out of order.
export function sortTripLegs(legs: TripLeg[]): TripLeg[] {
  return [...legs].sort((a, b) =>
    a.startDate.localeCompare(b.startDate) ||
    a.endDate.localeCompare(b.endDate) ||
    a.cityName.localeCompare(b.cityName) ||
    a.id.localeCompare(b.id),
  )
}

export function tripLegIssues(legs: TripLeg[]): string[] {
  const issues: string[] = []
  const ordered = sortTripLegs(legs)
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i].startDate <= ordered[i - 1].endDate) {
      issues.push(`${ordered[i - 1].cityName} and ${ordered[i].cityName} overlap on the same nights.`)
    }
  }
  return issues
}

function legIdForLegacyRecord(leg: Omit<TripLeg, 'id'>, index: number): string {
  return `legacy-${leg.cityKey}-${leg.startDate}-${leg.endDate}-${index}`.replace(/[^a-zA-Z0-9-]/g, '-')
}

function parseTripRecord(record: Record<string, unknown>): TripPlan {
  const rawLegs = safeParseArray<Omit<TripLeg, 'id'> & Partial<Pick<TripLeg, 'id'>>>(record.legs_json as string)
  const legs = sortTripLegs(rawLegs.map((leg, index) => ({ ...leg, id: leg.id || legIdForLegacyRecord(leg, index) })))
  return {
    id: record.id as string,
    startDate: (record.start_date as string)?.slice(0, 10),
    endDate: (record.end_date as string)?.slice(0, 10),
    legs,
    equipment: safeParseArray<string>(record.equipment_json as string),
    interests: safeParseArray<string>(record.interests_json as string),
    guides: safeParseObject<Record<string, TripLegGuide>>(record.guide_json as string) ?? {},
  }
}

function safeParseArray<T>(raw: string | undefined): T[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function safeParseObject<T>(raw: string | undefined): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

// A Sky Pass account has at most one trip at a time -- atlas_trip_plans has
// a unique index on `user`, so this is the only read path callers need.
export async function getActiveTripPlan(): Promise<TripPlan | null> {
  const userId = pb.authStore.record?.id
  if (!userId || !pb.authStore.isValid) return null
  try {
    const record = await pb.collection('atlas_trip_plans').getFirstListItem(`user = "${userId}"`)
    return parseTripRecord(record)
  } catch {
    return null
  }
}

export interface SaveTripPlanInput {
  startDate: string
  endDate: string
  legs: TripLeg[]
  equipment: string[]
  interests: string[]
}

// Creates the trip, or replaces the existing one if a trip already exists --
// this is what enforces "one trip at a time" client-side (the unique index
// on `user` enforces it server-side). Replacing clears any previously
// generated guide, since a changed itinerary invalidates it.
export async function saveTripPlan(input: SaveTripPlanInput): Promise<TripPlan> {
  const userId = pb.authStore.record?.id
  if (!userId || !pb.authStore.isValid) throw new Error('Sign in to plan a trip.')

  const payload = {
    user: userId,
    start_date: input.startDate,
    end_date: input.endDate,
    legs_json: JSON.stringify(sortTripLegs(input.legs)),
    equipment_json: JSON.stringify(input.equipment),
    interests_json: JSON.stringify(input.interests),
    guide_json: '{}',
    guide_generated_at: null,
  }

  const existing = await getActiveTripPlan()
  const record = existing ? await pb.collection('atlas_trip_plans').update(existing.id, payload) : await pb.collection('atlas_trip_plans').create(payload)
  return parseTripRecord(record)
}

export async function deleteTripPlan(id: string): Promise<void> {
  await pb.collection('atlas_trip_plans').delete(id)
}

// Persists a freshly generated guide for one leg, merging into whatever
// guides already exist for other legs on the same trip.
export async function saveTripLegGuide(trip: TripPlan, legId: string, guide: TripLegGuide): Promise<TripPlan> {
  const guides = { ...trip.guides, [legId]: guide }
  const record = await pb.collection('atlas_trip_plans').update(trip.id, {
    guide_json: JSON.stringify(guides),
    guide_generated_at: new Date().toISOString(),
  })
  return parseTripRecord(record)
}

// The leg covering `date` (defaults to now), if any -- mirrors trips.ts's
// activeTripFor() but across a multi-city plan's legs.
export function activeLegFor(trip: TripPlan, date: Date = new Date()): TripLeg | null {
  const key = date.toISOString().slice(0, 10)
  return sortTripLegs(trip.legs).find((leg) => leg.startDate <= key && key <= leg.endDate) ?? null
}

export function tripCoversDate(trip: TripPlan, date: Date = new Date()): boolean {
  return activeLegFor(trip, date) != null
}

// Re-exported so callers formatting guide_generated_at don't need to reach
// into pocketbaseDate.ts themselves.
export function parseGuideGeneratedAt(raw: string | undefined): Date | null {
  return raw ? parsePbDate(raw) : null
}

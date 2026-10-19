// Where was the user on a past date?
//
// A Sky Pass backdated check-in needs no photo, so it has no EXIF GPS and no
// EXIF time -- nothing anchors it to a place. Rather than ask for coordinates
// (which nobody knows) this reads the places the user has *already* told Atlas
// about. A backdated entry is then not a new claim about the world but a
// restatement of something already on file, which is both easier to give and
// easier to believe.
//
// Ordered strongest to weakest. The user picks from the list -- there is no
// silent default -- unless exactly one anchor exists, in which case picking
// would be a formality.
import { db } from './db'
import { CITIES, type City } from './cities'
import { activeTripFor } from './trips'
import { activeLegFor, getActiveTripPlan } from './tripPlans'

export type AnchorSource = 'trip' | 'trip-plan' | 'journal-location' | 'current-location'

export interface PastAnchor {
  /** 'YYYY-MM-DD' -- the date the anchor was resolved for, not the trip's dates. */
  date: string
  lat: number
  lon: number
  label: string
  source: AnchorSource
}

/**
 * Local noon for a 'YYYY-MM-DD', as a Date the trip helpers can read.
 *
 * Noon, not midnight, and this is load-bearing. Two helpers disagree about what
 * a day is: `activeTripFor` reads local date components (`localDateKey`) while
 * `activeLegFor` reads `toISOString().slice(0, 10)`, which is UTC. Midnight
 * local is therefore the one instant they can disagree about -- at +08:00 local
 * midnight is 16:00Z the *previous* day, so a trip starting on the 14th would
 * be judged as starting the 13th by the leg helper. Local noon is at most 12h
 * from UTC midnight in either direction, so both helpers see the same calendar
 * day and the disagreement never surfaces.
 *
 * The alternative -- aligning the two helpers -- means touching `activeLegFor`,
 * which the trip-guide screens also call, to fix a bug this call site can
 * sidestep. Passing noon is the whole fix.
 */
function localNoon(dayKey: string): Date {
  return new Date(`${dayKey}T12:00:00`)
}

/** Distance in days between two 'YYYY-MM-DD' keys, ignoring time. */
function dayGap(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000
}

/**
 * A journal location label resolved back to coordinates via the curated city
 * catalogue.
 *
 * Labels are written as `cityLabel(city)` output ("Melbourne, Victoria,
 * Australia"), so an exact match covers the common case; the fallback matches
 * on the bare city name so a label stored before a catalogue change, or one
 * carrying a region the catalogue has since dropped, still resolves.
 *
 * Returns null rather than guessing: a label that matches nothing cannot be
 * turned into a coordinate, and a wrong anchor is worse than no anchor because
 * it silently mis-places a diary entry.
 */
function cityForLabel(label: string): City | null {
  const normalised = label.trim().toLowerCase()
  if (!normalised) return null

  const exact = CITIES.find((city) => city.name.toLowerCase() === normalised)
  if (exact) return exact

  // Longest name first, so "Perth, Western Australia" is not matched by a
  // shorter city whose name happens to be a prefix.
  const leading = [...CITIES]
    .sort((a, b) => b.name.length - a.name.length)
    .find((city) => normalised.startsWith(`${city.name.toLowerCase()},`))
  return leading ?? null
}

/** Dedupe by rounded position, keeping the first (strongest) label for it. */
function dedupe(anchors: PastAnchor[]): PastAnchor[] {
  const seen = new Set<string>()
  const result: PastAnchor[] = []
  for (const anchor of anchors) {
    // ~1km. Two anchors at the same place are the same anchor however they
    // were arrived at, and re-listing the user's home under three different
    // provenances would read as a bug.
    const key = `${anchor.lat.toFixed(2)},${anchor.lon.toFixed(2)}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(anchor)
  }
  return result
}

/**
 * Every place the user can be said to have been on `dayKey`.
 *
 * Ordering is by how directly the user asserted it: a saved trip or trip-plan
 * leg is a statement about that specific window, a past journal location is a
 * statement about that specific place, and the current location is a guess
 * about a past date that is only ever offered last and labelled as such.
 *
 * `fallback` is the caller's resolved current location, passed in rather than
 * read here because the only non-hook source of it is a `useCurrentLocation`
 * that this module cannot call. Passing null simply omits that tier.
 */
export async function anchorsForDate(
  dayKey: string,
  userId: string,
  fallback?: { name: string; lat: number; lon: number } | null,
): Promise<PastAnchor[]> {
  const noon = localNoon(dayKey)
  const anchors: PastAnchor[] = []

  // --- Tier 1: a saved trip covering the date -------------------------------
  try {
    const trip = activeTripFor(noon)
    if (trip) {
      anchors.push({ date: dayKey, lat: trip.lat, lon: trip.lon, label: trip.name, source: 'trip' })
    }
  } catch {
    // localStorage unavailable (private mode) -- a missing anchor tier must not
    // take the whole list down with it.
  }

  // --- Tier 2: a trip-plan leg covering the date ----------------------------
  try {
    const plan = await getActiveTripPlan()
    if (plan) {
      const leg = activeLegFor(plan, noon)
      if (leg) {
        anchors.push({ date: dayKey, lat: leg.lat, lon: leg.lon, label: leg.cityName, source: 'trip-plan' })
      }
    }
  } catch {
    // Offline, or no signed-in PocketBase session -- getActiveTripPlan is a
    // network read and returns null for both, so this tier is simply skipped.
  }

  // --- Tier 3: where they actually checked in around that date ---------------
  // Genuinely self-anchoring: "you checked in from Melbourne on the 10th and
  // the 14th" is evidence about the 12th in a way that nothing else on this
  // list is, because it is a record of the user being there rather than a plan
  // to be there.
  try {
    const entries = await db.observations.where('userId').equals(userId).toArray()
    const nearby = entries
      .filter((entry) => entry.locationLabel && dayGap(entry.observedAt.slice(0, 10), dayKey) <= 3)
      // Closest to the target day first, so the most relevant place leads.
      .sort((a, b) => dayGap(a.observedAt.slice(0, 10), dayKey) - dayGap(b.observedAt.slice(0, 10), dayKey))

    for (const entry of nearby) {
      const city = cityForLabel(entry.locationLabel ?? '')
      if (!city) continue
      anchors.push({ date: dayKey, lat: city.lat, lon: city.lon, label: city.name, source: 'journal-location' })
    }
  } catch {
    // Dexie unavailable -- same reasoning as tier 1.
  }

  // --- Tier 4: the current location, offered last and only as a guess --------
  if (fallback) {
    anchors.push({ date: dayKey, lat: fallback.lat, lon: fallback.lon, label: fallback.name, source: 'current-location' })
  }

  return dedupe(anchors)
}

/**
 * Whether the sheet should skip the picker.
 *
 * Exactly one anchor means there is nothing to choose between, and a
 * one-option radio group is just a slower way to read the option. Zero anchors
 * is *not* the same case -- the caller must fall back to manual entry.
 */
export function needsAnchorChoice(anchors: PastAnchor[]): boolean {
  return anchors.length > 1
}

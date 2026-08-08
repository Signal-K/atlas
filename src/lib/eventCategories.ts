// Label/category metadata for every `kind` the backend ingest
// (scripts/ingest.mjs + scripts/sources/*.mjs) writes into PocketBase's
// sky_events collection. Kept as one lookup so the filter chip row, the
// per-event badge, and the "which source is this from" copy all agree.
export interface EventCategory {
  label: string
  /** Coarser bucket than kind, used to group filter chips. */
  group: string
}

export const EVENT_CATEGORIES: Record<string, EventCategory> = {
  moon_phase: { label: 'Moon', group: 'Moon' },
  meteor_shower: { label: 'Meteor shower', group: 'Meteors' },
  fireball: { label: 'Fireball', group: 'Meteors' },
  eclipse: { label: 'Eclipse', group: 'Eclipses' },
  conjunction: { label: 'Conjunction', group: 'Planets' },
  planet_event: { label: 'Planet', group: 'Planets' },
  asteroid_approach: { label: 'Asteroid approach', group: 'Asteroids' },
  comet: { label: 'Comet', group: 'Comets' },
  galaxy: { label: 'Galaxy', group: 'Deep sky' },
  nebula: { label: 'Nebula', group: 'Deep sky' },
  cluster: { label: 'Cluster', group: 'Deep sky' },
  deep_sky: { label: 'Deep sky', group: 'Deep sky' },
  aurora: { label: 'Aurora', group: 'Space weather' },
  solar_flare: { label: 'Solar flare', group: 'Space weather' },
  iss_pass: { label: 'ISS pass', group: 'Satellites' },
  satellite_flare: { label: 'Satellite flare', group: 'Satellites' },
  local_night_sky: { label: 'Night sky', group: 'Guides' },
}

const FALLBACK: EventCategory = { label: 'Sky event', group: 'Other' }

export function categoryFor(kind: string): EventCategory {
  return EVENT_CATEGORIES[kind] ?? FALLBACK
}

// Filter chip row order -- broadest/most common first.
export const CATEGORY_GROUPS = [
  'Moon',
  'Meteors',
  'Planets',
  'Eclipses',
  'Deep sky',
  'Asteroids',
  'Comets',
  'Satellites',
  'Space weather',
  'Guides',
  'Other',
]

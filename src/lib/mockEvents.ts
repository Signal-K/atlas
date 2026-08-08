import type { AtlasEvent } from './events'

// Local fallback data -- used only when PocketBase's `sky_events` collection
// is unreachable or empty (offline/demo mode, or a fresh dev DB that hasn't
// run `npm run ingest` yet). Shaped to match what the real ingest sources in
// scripts/sources/*.mjs actually write, so the UI looks the same either way.
// Spread across ~3 weeks and every real `kind` so day-grouping and the
// category filter have enough to demonstrate against without a backend.
const HOURS = 3_600_000

function at(daysFromNow: number, hour: number, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

interface MockSeed {
  day: number
  hour: number
  minute?: number
  title: string
  kind: string
  description: string
}

const SEEDS: MockSeed[] = [
  { day: 0, hour: 23, minute: 12, title: 'ISS Pass over Melbourne', kind: 'iss_pass', description: 'A visible pass reaching 62° above the horizon -- no telescope needed.' },
  { day: 0, hour: 20, title: 'New Moon', kind: 'moon_phase', description: 'No moonlight to wash out the sky -- the best night this month for faint deep-sky targets.' },
  { day: 1, hour: 21, title: 'Saturn at opposition', kind: 'planet_event', description: 'Saturn is at its closest and brightest for the year, visible all night.' },
  { day: 1, hour: 4, minute: 30, title: 'Iridium-style satellite flare', kind: 'satellite_flare', description: 'A brief, bright flash as sunlight glints off a satellite panel.' },
  { day: 2, hour: 22, title: 'M31 Andromeda Galaxy well placed', kind: 'galaxy', description: 'High in the sky after dark -- a good night for a long-exposure galaxy target.' },
  { day: 3, hour: 1, title: 'Perseid meteor shower peak', kind: 'meteor_shower', description: 'Up to 60 meteors/hour from a dark sky, radiant in Perseus.' },
  { day: 3, hour: 19, title: 'Venus-Jupiter conjunction', kind: 'conjunction', description: 'Venus and Jupiter appear less than 2° apart low in the evening sky.' },
  { day: 4, hour: 20, minute: 45, title: 'Orion Nebula (M42) rising', kind: 'nebula', description: 'One of the brightest nebulae, visible to the naked eye under dark skies.' },
  { day: 5, hour: 22, title: 'Comet C/2026 A1 tracker update', kind: 'comet', description: 'Latest brightness estimate and finder chart for this apparition.' },
  { day: 6, hour: 0, minute: 15, title: 'Near-Earth asteroid close approach', kind: 'asteroid_approach', description: 'Passes within 12 lunar distances -- needs a tracked telescope exposure to image.' },
  { day: 6, hour: 21, title: 'Pleiades cluster (M45) well placed', kind: 'cluster', description: 'A compact, bright open cluster easy to find naked-eye.' },
  { day: 7, hour: 20, title: 'Full Moon', kind: 'moon_phase', description: 'Fully illuminated and visible all night -- best conditions for lunar imaging.' },
  { day: 8, hour: 3, title: 'Aurora forecast: elevated activity', kind: 'aurora', description: 'Moderate geomagnetic activity forecast -- worth a check at high latitudes.' },
  { day: 9, hour: 22, title: 'Whirlpool Galaxy (M51) well placed', kind: 'galaxy', description: 'A classic spiral galaxy pairing, good target for a mid-size telescope.' },
  { day: 10, hour: 20, title: 'ISS Pass over Melbourne', kind: 'iss_pass', description: 'A bright, fast-moving pass reaching 48° above the horizon.' },
  { day: 11, hour: 19, minute: 30, title: 'Partial lunar eclipse', kind: 'eclipse', description: 'The Moon passes through Earth’s partial shadow -- visible without any equipment.' },
  { day: 12, hour: 21, title: 'Bright fireball reported', kind: 'fireball', description: 'A recent bolide detection reported by the all-sky camera network.' },
  { day: 13, hour: 22, title: 'Lagoon Nebula (M8) well placed', kind: 'nebula', description: 'A bright emission nebula in Sagittarius, good for wide-field imaging.' },
  { day: 14, hour: 20, title: 'Last Quarter Moon', kind: 'moon_phase', description: 'Half-illuminated -- moderate sky brightness, good for planetary targets.' },
  { day: 15, hour: 21, title: 'Mars-Regulus conjunction', kind: 'conjunction', description: 'Mars passes within 1° of Regulus in the evening sky.' },
  { day: 16, hour: 2, title: 'Solar flare activity elevated', kind: 'solar_flare', description: 'X-class flare activity -- possible aurora at high latitudes in the following days.' },
  { day: 17, hour: 22, title: 'Local dark-sky conditions this week', kind: 'local_night_sky', description: 'A roundup of the best viewing windows for your area this week.' },
  { day: 18, hour: 21, title: 'Ring Nebula (M57) well placed', kind: 'nebula', description: 'A small but bright planetary nebula, good for a mid-size telescope.' },
  { day: 19, hour: 23, title: 'ISS Pass over Melbourne', kind: 'iss_pass', description: 'A visible pass reaching 71° above the horizon -- an especially bright one.' },
  { day: 20, hour: 20, title: 'New Moon', kind: 'moon_phase', description: 'Dark skies return -- the best few nights of the month for faint targets.' },
]

export const MOCK_EVENTS: AtlasEvent[] = SEEDS.map((seed, index) => ({
  id: `mock-${index}`,
  kind: seed.kind,
  title: seed.title,
  description: seed.description,
  starts_at: at(seed.day, seed.hour, seed.minute),
}))

export const MOCK_EVENTS_WINDOW_MS = 21 * 24 * HOURS

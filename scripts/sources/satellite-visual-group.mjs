// Event-source plugin: naked-eye passes for Celestrak's "visual" group --
// their own curated list of the ~100 brightest objects in orbit (mostly
// old rocket bodies that tumble and flare unpredictably, plus a few
// well-known satellites), beyond the ISS/Tiangong/Hubble already covered
// individually in satellite-flares.mjs. Free, keyless, same Celestrak
// endpoint family as every other satellite source here.
//
// Deliberately lightweight: capped to a small satellite subset and a
// short window, rather than propagating the full ~100-object group across
// every city -- SGP4 propagation cost is O(satellites x cities x
// window/step), and this plugin already stacks on top of satellite-flares'
// own cost in the same ingest run.
import * as satellite from 'satellite.js'
import { CITIES } from './cities.mjs'
import { parseTleGroup, passesForCity } from './satellitePasses.mjs'

const VISUAL_GROUP_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle'

// Already covered by name-specific plugins -- skip to avoid duplicate
// "X pass over Y" cards for the same object.
const EXCLUDED_CATALOG_NUMBERS = new Set([25544, 48274, 20580]) // ISS, Tiangong, Hubble

// Kept small on purpose: an early pass at 20 satellites over the full city
// list produced ~2,700 events in a 3-day window alone -- more noise than
// signal, and it would drown out every other event kind in the feed. 8
// objects at a higher elevation bar keeps this "a bit of variety," not "the
// feed is now entirely satellite passes."
const MAX_SATELLITES = 8
const DEFAULT_WINDOW_DAYS = 3
// Higher than the shared MIN_ELEVATION_DEG (20°) -- these are dimmer,
// less-famous objects than the ISS/Tiangong/Hubble, so only surface the
// passes confidently high enough to be worth looking up for.
const MIN_ELEVATION_DEG = 35

function catalogNumber(line1) {
  return parseInt(line1.slice(2, 7), 10)
}

export async function fetchEvents({ now = new Date(), windowDays = DEFAULT_WINDOW_DAYS } = {}) {
  const res = await fetch(VISUAL_GROUP_URL)
  if (!res.ok) throw new Error(`Celestrak visual group fetch failed: ${res.status}`)
  const group = parseTleGroup(await res.text())

  const selected = group.filter((sat) => !EXCLUDED_CATALOG_NUMBERS.has(catalogNumber(sat.line1))).slice(0, MAX_SATELLITES)

  const start = now.getTime()
  const end = start + windowDays * 86_400_000
  const events = []

  for (const sat of selected) {
    let satrec
    try {
      satrec = satellite.twoline2satrec(sat.line1, sat.line2)
    } catch {
      continue // Malformed TLE line for this one object -- skip it, not the whole run.
    }
    const name = sat.name.trim()

    for (const city of CITIES) {
      for (const pass of passesForCity(satrec, city, start, end, MIN_ELEVATION_DEG)) {
        events.push({
          kind: 'satellite_flare',
          target: `visual_${catalogNumber(sat.line1)}_${city.name.toLowerCase().replace(/\s+/g, '_')}`,
          title: `${name} Pass over ${city.name}`,
          description: `A visible pass of ${name} over ${city.name}, reaching ${Math.round(pass.maxElevation)}° above the horizon.`,
          content: `${name} will be visible as a point of light (no telescope needed) reaching a peak elevation of about ${Math.round(pass.maxElevation)}° above the horizon. Many objects in this list are old rocket bodies that tumble, so brightness can vary noticeably during the pass rather than staying steady like the ISS.`,
          starts_at: pass.start.toISOString(),
          ends_at: pass.end.toISOString(),
          latitude: city.lat,
          longitude: city.lon,
          image_url: '',
          image_credit: '',
        })
      }
    }
  }

  return events
}

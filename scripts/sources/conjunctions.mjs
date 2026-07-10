// Event-source plugin: planet-planet and Moon-planet conjunctions, computed
// algorithmically via astronomy-engine's PairLongitude (no external API).
// "conjunction" has been a supported sky_events kind since the original
// schema (AT-002) but never had a producing plugin until now — it's the
// single biggest source of non-ISS-pass variety available without adding a
// new external dependency.
import * as Astronomy from 'astronomy-engine'
import { PLANET_IMAGES } from './planet-images.mjs'

const MOON_CONJUNCTION_BODIES = ['Venus', 'Mars', 'Jupiter', 'Saturn']
const PLANET_PAIR_BODIES = [
  ['Venus', 'Jupiter'],
  ['Venus', 'Mars'],
  ['Venus', 'Saturn'],
  ['Mars', 'Jupiter'],
  ['Mars', 'Saturn'],
  ['Jupiter', 'Saturn'],
]

// "Close together in the sky" -- naked-eye conjunctions are usually called
// out well inside this margin, but this is generous enough to also catch
// the wider, still-notable pairings.
const CONJUNCTION_THRESHOLD_DEG = 5
const STEP_DAYS = 1

// PairLongitude returns [0, 360) -- the angular separation is whichever of
// the two arcs around the circle is shorter.
function angularDiff(body1, body2, date) {
  const lon = Astronomy.PairLongitude(body1, body2, date)
  return lon > 180 ? 360 - lon : lon
}

function findConjunctions(body1, body2, now, end) {
  // Stepped from a fixed UTC-midnight grid, not from `now` itself: anchoring
  // to the wall-clock time the ingest happens to run at means each run
  // computes a slightly different local-minimum timestamp for the same
  // calendar-day conjunction (a few minutes off, run to run), which falls
  // outside the ingest upsert's +/-10 minute dedup window and silently
  // creates a duplicate record every time the workflow runs.
  const gridStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const points = []
  for (let t = gridStart; t <= end; t += STEP_DAYS * 86_400_000) {
    const date = new Date(t)
    if (date.getTime() < now.getTime() - STEP_DAYS * 86_400_000) continue
    points.push({ date, diff: angularDiff(body1, body2, date) })
  }

  const conjunctions = []
  for (let i = 1; i < points.length - 1; i += 1) {
    const { date, diff } = points[i]
    if (diff < CONJUNCTION_THRESHOLD_DEG && diff <= points[i - 1].diff && diff <= points[i + 1].diff) {
      conjunctions.push({ date, separation: diff })
    }
  }
  return conjunctions
}

export async function fetchEvents({ now = new Date(), windowDays = 365 } = {}) {
  const end = now.getTime() + windowDays * 86_400_000
  const events = []

  for (const bodyName of MOON_CONJUNCTION_BODIES) {
    for (const { date, separation } of findConjunctions(Astronomy.Body.Moon, Astronomy.Body[bodyName], now, end)) {
      events.push({
        kind: 'conjunction',
        target: `moon_${bodyName.toLowerCase()}`,
        title: `Moon-${bodyName} Conjunction`,
        description: `The Moon and ${bodyName} appear close together in the sky, about ${separation.toFixed(1)}° apart.`,
        content: `Look for the Moon and ${bodyName} sharing the same patch of sky tonight (about ${separation.toFixed(1)}° apart) — a striking naked-eye pairing, no equipment needed.`,
        starts_at: date.toISOString(),
        ends_at: date.toISOString(),
        image_url: PLANET_IMAGES[bodyName].url,
        image_credit: PLANET_IMAGES[bodyName].credit,
      })
    }
  }

  for (const [a, b] of PLANET_PAIR_BODIES) {
    for (const { date, separation } of findConjunctions(Astronomy.Body[a], Astronomy.Body[b], now, end)) {
      events.push({
        kind: 'conjunction',
        target: `${a.toLowerCase()}_${b.toLowerCase()}`,
        title: `${a}-${b} Conjunction`,
        description: `${a} and ${b} appear close together in the sky, about ${separation.toFixed(1)}° apart.`,
        content: `${a} and ${b} are near each other in the sky tonight (about ${separation.toFixed(1)}° apart) — a rare and striking naked-eye pairing worth looking up for.`,
        starts_at: date.toISOString(),
        ends_at: date.toISOString(),
        // The dimmer/farther body is usually harder to spot, so the brighter
        // one's photo is the more useful "what am I looking for" cue.
        image_url: PLANET_IMAGES[a].url,
        image_credit: PLANET_IMAGES[a].credit,
      })
    }
  }

  return events
}

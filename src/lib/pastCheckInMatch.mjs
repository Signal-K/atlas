// "Which real event was this photo of?"
//
// Deterministic and offline. Given a past day's generated events plus what we
// could read from the photo (a trustworthy instant, coordinates, a camera
// heading, and whatever identifySky() recognised in the frame), this ranks the
// candidates and says how sure it is.
//
// There is deliberately no score. A numeric confidence invites threshold
// arguments that this data cannot settle -- "0.62 means what, exactly?" -- so
// confidence is an ordered enum with a stated condition per band.
//
// Pure .mjs with no TypeScript imports, so test/past-checkin-match.test.mjs
// runs it directly under `node --test`.
import { isLocalEvent, localEventDistanceKm } from './eventGeo.mjs'
import { isVisibleFromLocation, POINT_EVENT_WINDOW_HOURS } from './eventVisibility.mjs'
import { bodyForTarget, getHorizontalPosition } from './skyPosition.ts'

// Kinds where the event itself is the story. A photo taken during a three-hour
// eclipse window does not need its frame parsed to know what it is, so these
// reach the top band on time overlap alone. Everything else has to be
// corroborated by what identifySky() saw.
//
// Lived in sync.ts until the ranker gave it a consumer; nothing else used it.
export const FLAGSHIP_KINDS = new Set(['eclipse', 'meteor_shower'])

// Ordered strongest first. `none` is not a band a candidate can be in -- it is
// the answer when nothing qualifies at all.
export const CONFIDENCE_ORDER = ['strong', 'possible', 'weak']

/**
 * A candidate event and why it is here.
 * @typedef {{
 *   event: import('./db').SkyEvent,
 *   confidence: 'strong' | 'possible' | 'weak',
 *   distanceKm: number | null,
 *   timeDeltaMs: number | null,
 *   frame: 'agrees' | 'disagrees' | 'skipped',
 *   reasons: string[],
 *   azimuthDeg: number | null,
 * }} RankedCandidate
 */

function midpointMs(event) {
  return (new Date(event.startsAt).getTime() + new Date(event.endsAt ?? event.startsAt).getTime()) / 2
}

/**
 * Gate C. Point events (moon_phase, planet_event, conjunction) arrive with
 * startsAt === endsAt -- a single exact instant, not a viewing span -- so a
 * naive containment check matches nothing. Reuses the same +/-6h widening
 * eventVisibility.mjs applies, for the same reason (ASV-34).
 */
function overlapsInstant(event, instantMs) {
  const start = new Date(event.startsAt).getTime()
  const end = new Date(event.endsAt ?? event.startsAt).getTime()
  if (end > start) return start <= instantMs && instantMs <= end
  const half = POINT_EVENT_WINDOW_HOURS * 3_600_000
  return start - half <= instantMs && instantMs <= start + half
}

/**
 * The bodies an event's frame would have to contain, or null when the event
 * has no single point body to look for.
 *
 * Returning null is the important case: a meteor shower photo is a streak
 * against a star field and an eclipse photo is a solar/lunar disc, neither of
 * which identifySky() names. Those must not be penalised for a frame the
 * identifier was never built to read.
 */
function requiredBodies(event) {
  const raw =
    event.kind === 'moon_phase' ? ['moon']
      : event.kind === 'planet_event' ? [event.target]
        : event.kind === 'conjunction' ? event.target.split('_')
          : []
  if (raw.length === 0) return null
  // Every component has to be a body the ephemeris can place, or gate D would
  // demand a name identifySky() can never emit and reject on a technicality.
  // astronomy-engine is target-kind agnostic, so planet_event's lookup serves
  // a conjunction's components (including its 'moon' half) equally well.
  const placeable = raw.every((target) => bodyForTarget('planet_event', target) != null)
  return placeable ? raw : null
}

/**
 * The one body to point at to say "the camera was roughly facing this", or
 * null for kinds where there is no such body (an eclipse is a disc, a shower
 * is a radiant, a satellite is a moving point).
 */
function primaryBodyFor(event) {
  // bodyForTarget returns Body.Moon for any moon_phase regardless of target,
  // which is what we want here -- all four phases are the same disc.
  if (event.kind === 'moon_phase') return bodyForTarget('moon_phase', event.target)
  if (event.kind === 'planet_event') return bodyForTarget('planet_event', event.target)
  // The bright half of the pair anchors the heading better than the faint one.
  if (event.kind === 'conjunction') return bodyForTarget('planet_event', event.target.split('_')[0])
  return null
}

/**
 * Where the event's body sat, for the heading tie-break only. Returns null
 * whenever there is nothing to point at, which sorts as "no opinion" rather
 * than as "pointing the wrong way".
 */
function eventAzimuthDeg(event, atMs, lat, lon) {
  if (atMs == null) return null
  const body = primaryBodyFor(event)
  if (body == null) return null
  try {
    return getHorizontalPosition(body, new Date(atMs), lat, lon).azimuthDeg
  } catch {
    return null
  }
}

/**
 * Gate D -- frame content. Orders, never rejects.
 *
 * Reads `aboveHorizon`, never `objects`. `objects` is narrowed to +/-40deg of
 * GPSImgDirection when EXIF carried a heading, so judging "this photo is of
 * the Moon" against it would let a wrong, stale or rotated compass reading
 * rule out the correct answer outright -- exactly the coupling skyPhotoId.ts
 * already avoids for closestPair. Heading is a tie-break in this module and
 * nothing else.
 *
 * `?? identified.objects` tolerates a caller (or a test fixture) that built
 * the object before aboveHorizon existed. Both are unfiltered when no heading
 * was supplied, which is the case gate D is really about.
 */
function frameVerdict(event, identified) {
  if (!identified) return 'skipped'
  const required = requiredBodies(event)
  if (required == null) return 'skipped'
  const seen = identified.aboveHorizon ?? identified.objects
  const present = new Set(seen.map((object) => object.target))
  // The pair is judged across everything visible, not just what survived the
  // heading/FOV filter, so it can name a body the objects list dropped.
  if (identified.closestPair) {
    present.add(identified.closestPair.a.toLowerCase())
    present.add(identified.closestPair.b.toLowerCase())
  }
  return required.every((target) => present.has(target)) ? 'agrees' : 'disagrees'
}

/** Angular separation in degrees, taking the short way round. */
function azimuthGap(headingDeg, azimuthDeg) {
  if (headingDeg == null || azimuthDeg == null) return 180
  const diff = Math.abs(headingDeg - azimuthDeg) % 360
  return diff > 180 ? 360 - diff : diff
}

/**
 * Ascending, with null sorting last as "no opinion".
 *
 * Written out rather than done as `(a ?? Infinity) - (b ?? Infinity)`, which
 * is the trap: two nulls give `Infinity - Infinity` = `NaN`, and `NaN !== 0`
 * is true, so the comparator returns NaN and every later tie-break is never
 * reached. A comparator that returns NaN leaves the order implementation-
 * defined, so the list silently keeps its input order.
 *
 * That is not a corner case here -- generated past events carry no
 * coordinates at all (skyEventFromGenerated sets none), so *every* candidate
 * on the generated path has distanceKm === null. The naive form killed the
 * time and azimuth tie-breaks for the whole feature.
 */
function compareNullableAsc(a, b) {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return a - b
}

/**
 * Rank past events against a photo.
 *
 * @param {import('./db').SkyEvent[]} events
 * @param {{
 *   lat: number,
 *   lon: number,
 *   instant?: Date | null,
 *   headingDeg?: number | null,
 *   identified?: { aboveHorizon?: Array<{ target: string }>, objects: Array<{ target: string, azimuthDeg: number }>, closestPair: { a: string, b: string } | null } | null,
 * }} options
 *   `instant: null` means the photo's time could not be trusted (no EXIF
 *   timestamp, or the user overrode the day) -- that is what produces the
 *   `weak` band rather than a rejection.
 * @returns {{ confidence: 'strong' | 'possible' | 'weak' | 'none', candidates: RankedCandidate[] }}
 */
export function rankPastEventCandidates(events, { lat, lon, instant = null, headingDeg = null, identified = null }) {
  const instantMs = instant ? new Date(instant).getTime() : null
  const candidates = []

  for (const event of events) {
    // Gate A -- geographic. Truthy for any event without coordinates, which
    // is correct (eclipses and showers are not tied to one city) but is also
    // why moon_phase needs its own demotion below.
    if (!isLocalEvent(event, lat, lon)) continue

    // Gate B -- observable from this place at this time of night.
    if (!isVisibleFromLocation(event, lat, lon)) continue

    const distanceKm = localEventDistanceKm(event, lat, lon)
    const frame = frameVerdict(event, identified)
    const reasons = []

    const azimuthAt = instantMs ?? midpointMs(event)
    // Only ever needed for the tie-break, so it is not computed when the
    // caller had no heading to compare against.
    const azimuthDeg = headingDeg == null ? null : eventAzimuthDeg(event, azimuthAt, lat, lon)

    if (instantMs == null) {
      // No trustworthy time: the day is the user's claim, so nothing here can
      // be auto-selected. Offered as "also that night" chips instead.
      reasons.push('no-trustworthy-time')
      candidates.push({ event, confidence: 'weak', distanceKm, timeDeltaMs: null, frame, reasons, azimuthDeg })
      continue
    }

    if (!overlapsInstant(event, instantMs)) continue

    const isFlagship = FLAGSHIP_KINDS.has(event.kind)
    let confidence
    if (frame === 'agrees') {
      confidence = 'strong'
      reasons.push('frame-match')
    } else if (frame === 'skipped' && isFlagship) {
      confidence = 'strong'
      reasons.push('flagship-kind')
    } else if (frame === 'skipped' && event.kind === 'moon_phase') {
      // isLocalEvent() is true for a moon_phase event everywhere, and there is
      // a phase most nights, so "time overlap alone" would hand a London user
      // photographing the Moon a confident match to a near-meaningless event
      // and make the photo requirement read as a formality. Needs the frame.
      confidence = 'possible'
      reasons.push('moon-phase-needs-frame')
    } else {
      confidence = 'possible'
      reasons.push(frame === 'disagrees' ? 'frame-disagrees' : 'unconfirmed')
    }

    candidates.push({
      event,
      confidence,
      distanceKm,
      timeDeltaMs: Math.abs(midpointMs(event) - instantMs),
      frame,
      reasons,
      azimuthDeg,
    })
  }

  candidates.sort(compareCandidates(headingDeg))
  const confidence = CONFIDENCE_ORDER.find((band) => candidates.some((c) => c.confidence === band)) ?? 'none'
  return { confidence, candidates }
}

/**
 * FLAGSHIP first, then moon_phase last, then nearer, then closer in time, then
 * nearer to where the camera was pointed. Heading is the final tie-break and
 * never a filter -- GPSImgDirection can be a few degrees off, the same stance
 * skyPhotoId.ts already takes.
 */
function compareCandidates(headingDeg) {
  return (a, b) => {
    const rank = (candidate) => CONFIDENCE_ORDER.indexOf(candidate.confidence)
    if (rank(a) !== rank(b)) return rank(a) - rank(b)

    const flagship = Number(FLAGSHIP_KINDS.has(b.event.kind)) - Number(FLAGSHIP_KINDS.has(a.event.kind))
    if (flagship !== 0) return flagship

    const moon = Number(a.event.kind === 'moon_phase') - Number(b.event.kind === 'moon_phase')
    if (moon !== 0) return moon

    // Unlocated events (null) sort after located ones: if the photo has GPS
    // and an event is pinned near it, that is the more specific answer.
    const distance = compareNullableAsc(a.distanceKm, b.distanceKm)
    if (distance !== 0) return distance

    const time = compareNullableAsc(a.timeDeltaMs, b.timeDeltaMs)
    if (time !== 0) return time

    return azimuthGap(headingDeg, a.azimuthDeg) - azimuthGap(headingDeg, b.azimuthDeg)
  }
}

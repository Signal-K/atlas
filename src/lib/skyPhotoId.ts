// ASV-33: identify what's in a sky photo from its EXIF time/GPS/heading.
// Reuses skyPosition.ts's cached alt/az lookup (the same one Tonight/the
// sky map already use) rather than recomputing ephemerides from scratch.
import * as Astronomy from 'astronomy-engine'
import { azimuthToCompass, getHorizontalPosition, type HorizontalPosition } from './skyPosition'

export interface SkyPhotoIdInput {
  date: Date
  lat: number
  lon: number
  // Compass heading the camera was facing (0-360, from GPSImgDirection),
  // when EXIF carried it. Narrows results to what's actually in frame
  // instead of everything above the horizon.
  headingDeg?: number
}

export interface IdentifiedObject extends HorizontalPosition {
  name: string
  target: string
}

export interface ConjunctionPair {
  a: string
  b: string
  separationDeg: number
}

export interface SkyPhotoIdResult {
  // Ranked by relevance: within the camera's field of view and closest to
  // its heading when headingDeg is known, otherwise by altitude (higher =
  // more likely to be the bright thing someone pointed a phone at).
  objects: IdentifiedObject[]
  // Everything above the horizon, ignoring the heading/FOV filter entirely.
  //
  // Callers that ask "was body X in the sky at that moment?" must use this
  // rather than `objects`. `objects` is heading-filtered when a heading is
  // supplied, so judging "this photo is of the Moon" against it would let a
  // wrong or rotated GPSImgDirection silently rule out the right answer --
  // the same reasoning that already keeps closestPair unfiltered below.
  aboveHorizon: IdentifiedObject[]
  // The tightest pairing among visible bodies, if any two are close enough
  // to plausibly be "the thing next to the other thing" in the photo (e.g.
  // "crescent Moon with a bright point beside it").
  closestPair: ConjunctionPair | null
  summary: string
}

// Naked-eye bodies only -- matches this feature's stated v1 scope (no
// plate-solving, no faint deep-sky/star-field identification).
const NAKED_EYE_BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const

// A photo taken right at the horizon can still show something a degree or
// two below the geometric horizon (haze/refraction), so don't cut off
// exactly at 0.
const MIN_ALTITUDE_DEG = -2
// A typical phone's main camera is ~65-80deg wide; half that either side of
// the reported heading comfortably covers the frame without pulling in
// things well outside it.
const FOV_HALF_DEG = 40
// Two bodies this close together read as "paired" in a photo -- matches
// conjunctions.mjs's own naked-eye threshold.
const NOTABLE_PAIR_DEG = 5

function angularSeparationDeg(a: HorizontalPosition, b: HorizontalPosition): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const alt1 = toRad(a.altitudeDeg)
  const alt2 = toRad(b.altitudeDeg)
  const dAz = toRad(a.azimuthDeg - b.azimuthDeg)
  const cosSep = Math.sin(alt1) * Math.sin(alt2) + Math.cos(alt1) * Math.cos(alt2) * Math.cos(dAz)
  return (Math.acos(Math.min(1, Math.max(-1, cosSep))) * 180) / Math.PI
}

function azimuthDiffDeg(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

function buildSummary(objects: IdentifiedObject[], closestPair: ConjunctionPair | null): string {
  if (objects.length === 0) return "Nothing bright enough to name was above the horizon in that direction at that time."
  if (closestPair) {
    return `${closestPair.a} and ${closestPair.b} were about ${closestPair.separationDeg.toFixed(1)}° apart — likely the pairing in your photo.`
  }
  const [first] = objects
  return `${first.name} was the brightest naked-eye object in that part of the sky, ${Math.round(first.altitudeDeg)}° above the horizon in the ${first.compassLabel}.`
}

export function identifySky({ date, lat, lon, headingDeg }: SkyPhotoIdInput): SkyPhotoIdResult {
  const visible: IdentifiedObject[] = []
  for (const name of NAKED_EYE_BODIES) {
    const body = Astronomy.Body[name]
    const position = getHorizontalPosition(body, date, lat, lon)
    if (position.altitudeDeg < MIN_ALTITUDE_DEG) continue
    visible.push({ ...position, name, target: name.toLowerCase() })
  }

  let objects = visible
  if (headingDeg != null && Number.isFinite(headingDeg)) {
    objects = visible
      .filter((object) => azimuthDiffDeg(object.azimuthDeg, headingDeg) <= FOV_HALF_DEG)
      .sort((a, b) => azimuthDiffDeg(a.azimuthDeg, headingDeg) - azimuthDiffDeg(b.azimuthDeg, headingDeg))
  } else {
    objects = [...visible].sort((a, b) => b.altitudeDeg - a.altitudeDeg)
  }

  // The closest pair is judged across everything actually visible, not just
  // what survived the heading/FOV filter -- a real conjunction is still the
  // right answer even if GPSImgDirection was a few degrees off.
  let closestPair: ConjunctionPair | null = null
  for (let i = 0; i < visible.length; i += 1) {
    for (let j = i + 1; j < visible.length; j += 1) {
      const separationDeg = angularSeparationDeg(visible[i], visible[j])
      if (separationDeg > NOTABLE_PAIR_DEG) continue
      if (!closestPair || separationDeg < closestPair.separationDeg) {
        closestPair = { a: visible[i].name, b: visible[j].name, separationDeg }
      }
    }
  }

  return { objects, aboveHorizon: visible, closestPair, summary: buildSummary(objects, closestPair) }
}

export { azimuthToCompass }

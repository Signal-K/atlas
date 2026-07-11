// Shared SGP4 pass-prediction core, factored out of iss-passes.mjs so it
// can drive other bright/naked-eye-visible satellites too (Tiangong,
// Starlink) without duplicating the propagation/darkness/shadow logic.
import * as satellite from 'satellite.js'

// Raised from 10: at low grazing passes (10-20 above the horizon, often
// behind buildings/trees) drown out every other event kind in the feed.
// 20 keeps genuinely worth-looking-up-for passes only.
export const MIN_ELEVATION_DEG = 20
const STEP_MS = 60_000 // 1 minute
const SUN_DARKNESS_DEG = -6 // civil twilight or darker at the observer
const AU_KM = 149_597_870.7

// Celestrak throttles repeat requests for the same query within a short
// window and, instead of an error status, returns a 200 with a plain-text
// notice ("GP data has not updated since your last successful download of
// ...") in place of TLE data. Silently treating that as garbage TLE lines
// produces satellites that fail to propagate (SGP4 returns null position
// rather than throwing) and just look like "no passes found" -- worth
// failing loudly instead so a broken/rate-limited fetch doesn't quietly
// become an empty-but-successful ingest run.
function isTleLine(line, expectedPrefix) {
  return typeof line === 'string' && line.startsWith(expectedPrefix)
}

export async function fetchTle(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`TLE fetch failed (${url}): ${res.status}`)
  const lines = (await res.text()).trim().split('\n')
  const [, line1, line2] = lines
  if (!isTleLine(line1, '1 ') || !isTleLine(line2, '2 ')) {
    throw new Error(`TLE fetch (${url}) did not return valid TLE lines: ${lines[0]}`)
  }
  return { line1, line2 }
}

// Parses a multi-satellite 3-line-element group text response (as served by
// Celestrak's `?GROUP=...&FORMAT=tle` endpoints) into { name, line1, line2 }
// entries. Throws if the response isn't actually TLE data (see note above
// on Celestrak's throttle-notice response) rather than silently returning
// zero usable satellites.
export function parseTleGroup(text) {
  const lines = text.trim().split('\n').map((line) => line.trim())
  const satellites = []
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const [name, line1, line2] = [lines[i], lines[i + 1], lines[i + 2]]
    if (!isTleLine(line1, '1 ') || !isTleLine(line2, '2 ')) {
      throw new Error(`TLE group response did not parse as valid TLE data (offending line: ${line1})`)
    }
    satellites.push({ name, line1, line2 })
  }
  if (satellites.length === 0) throw new Error('TLE group response contained no satellites')
  return satellites
}

function elevationDegrees(observerGd, ecf) {
  return satellite.radiansToDegrees(satellite.ecfToLookAngles(observerGd, ecf).elevation)
}

export function passesForCity(satrec, city, start, end, minElevationDeg = MIN_ELEVATION_DEG) {
  const passes = []
  const observerGd = {
    latitude: satellite.degreesToRadians(city.lat),
    longitude: satellite.degreesToRadians(city.lon),
    height: 0.05,
  }

  let current = null

  for (let t = start; t <= end; t += STEP_MS) {
    const date = new Date(t)
    const gmst = satellite.gstime(date)
    const posVel = satellite.propagate(satrec, date)
    if (!posVel.position) continue

    const satEcf = satellite.eciToEcf(posVel.position, gmst)
    const satElevation = elevationDegrees(observerGd, satEcf)

    if (satElevation >= minElevationDeg) {
      if (!current) current = { start: date, maxElevation: satElevation }
      else current.maxElevation = Math.max(current.maxElevation, satElevation)
      current.end = date
    } else if (current) {
      passes.push(current)
      current = null
    }
  }
  if (current) passes.push(current)

  // Only passes that are actually visible: dark at the observer, and the
  // satellite itself sunlit (not in Earth's shadow) at the pass's peak.
  return passes.filter((pass) => {
    const midTime = new Date((pass.start.getTime() + pass.end.getTime()) / 2)
    const gmst = satellite.gstime(midTime)

    const sunEciAu = satellite.sunPos(satellite.jday(midTime)).rsun
    const sunEciKm = { x: sunEciAu.x * AU_KM, y: sunEciAu.y * AU_KM, z: sunEciAu.z * AU_KM }
    const sunEcf = satellite.eciToEcf(sunEciKm, gmst)
    const sunElevation = elevationDegrees(observerGd, sunEcf)
    if (sunElevation > SUN_DARKNESS_DEG) return false

    const posVel = satellite.propagate(satrec, midTime)
    if (!posVel.position) return false
    const shadow = satellite.shadowFraction(sunEciAu, posVel.position)
    return shadow < 0.99
  })
}

// Event-source plugin: real ISS pass predictions via SGP4 orbit propagation
// (satellite.js) against a live TLE from Celestrak, not a canned/guessed
// schedule. Location-specific by nature (unlike moon phases/eclipses), so
// each pass event carries the observing city's lat/lon.
//
// Default window is intentionally short (a few days): TLEs go stale and
// pass predictions more than ~1-2 weeks out become unreliable, so a longer
// window here would be misleading rather than more useful.
import * as satellite from 'satellite.js'
import { CITIES } from './cities.mjs'

const TLE_URL = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE'
const STEP_MS = 60_000 // 1 minute
const MIN_ELEVATION_DEG = 10 // above this = "worth looking up for"
const SUN_DARKNESS_DEG = -6 // civil twilight or darker at the observer
const AU_KM = 149_597_870.7

async function fetchTle() {
  const res = await fetch(TLE_URL)
  if (!res.ok) throw new Error(`Celestrak TLE fetch failed: ${res.status}`)
  const lines = (await res.text()).trim().split('\n')
  return { line1: lines[1], line2: lines[2] }
}

function elevationDegrees(observerGd, ecf) {
  return satellite.radiansToDegrees(satellite.ecfToLookAngles(observerGd, ecf).elevation)
}

function passesForCity(satrec, city, start, end) {
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

    if (satElevation >= MIN_ELEVATION_DEG) {
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
  // ISS itself sunlit (not in Earth's shadow) at the pass's peak.
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

export async function fetchEvents({ now = new Date(), windowDays = 5 } = {}) {
  const { line1, line2 } = await fetchTle()
  const satrec = satellite.twoline2satrec(line1, line2)

  const start = now.getTime()
  const end = start + windowDays * 86_400_000
  const events = []

  for (const city of CITIES) {
    for (const pass of passesForCity(satrec, city, start, end)) {
      events.push({
        kind: 'iss_pass',
        target: 'iss',
        title: `ISS Pass over ${city.name}`,
        description: `A visible pass of the International Space Station over ${city.name}, reaching ${Math.round(pass.maxElevation)}° above the horizon.`,
        content: `The ISS will be visible as a bright, fast-moving point of light (no telescope needed) reaching a peak elevation of about ${Math.round(pass.maxElevation)}° above the horizon. Look for it moving steadily across the sky — unlike aircraft, it won't blink and won't change direction.`,
        starts_at: pass.start.toISOString(),
        ends_at: pass.end.toISOString(),
        latitude: city.lat,
        longitude: city.lon,
      })
    }
  }

  return events
}

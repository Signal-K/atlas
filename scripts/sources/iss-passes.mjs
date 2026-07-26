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
import { fetchTle, passesForCity } from './satellitePasses.mjs'

const TLE_URL = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE'

export async function fetchEvents({ now = new Date(), windowDays = 7 } = {}) {
  const { line1, line2 } = await fetchTle(TLE_URL)
  const satrec = satellite.twoline2satrec(line1, line2)

  const start = now.getTime()
  const end = start + windowDays * 86_400_000
  const events = []

  for (const city of CITIES) {
    for (const pass of passesForCity(satrec, city, start, end)) {
      events.push({
        kind: 'iss_pass',
        // Disambiguates cities for dedup purposes -- otherwise every city
        // shares the same target and only the timestamp tells them apart.
        target: `iss_${city.name.toLowerCase().replace(/\s+/g, '_')}`,
        title: `ISS Pass over ${city.name}`,
        description: `A visible pass of the International Space Station over ${city.name}, reaching ${Math.round(pass.maxElevation)}° above the horizon.`,
        content: `The ISS will be visible as a bright, fast-moving point of light (no telescope needed) reaching a peak elevation of about ${Math.round(pass.maxElevation)}° above the horizon. Look for it moving steadily across the sky — unlike aircraft, it won't blink and won't change direction.`,
        starts_at: pass.start.toISOString(),
        ends_at: pass.end.toISOString(),
        latitude: city.lat,
        longitude: city.lon,
        image_url: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/STS-134_International_Space_Station_after_undocking.jpg',
        image_credit: 'NASA, Wikimedia Commons',
      })
    }
  }

  return events
}

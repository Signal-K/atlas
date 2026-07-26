// Event-source plugin: near-Earth asteroid close approaches from JPL's
// Small-Body Database Close-Approach Data API -- free, keyless, no rate
// limit beyond fair use. Global (not city-specific), like moon phases/
// meteor showers, since a close approach is a real event happening at a
// specific moment regardless of the viewer's location -- most of these
// need a telescope and tracked exposure to actually image, not naked-eye
// viewing, same tier as deep-sky objects/comets.
import { searchCommonsImage } from './commons-image.mjs'

const CAD_API_URL = 'https://ssd-api.jpl.nasa.gov/cad.api'

// 0.05 AU (~19.5 lunar distances) keeps this to genuinely close, notable
// approaches -- JPL's database has thousands of much more distant ones
// that wouldn't mean anything to a casual observer.
const MAX_DISTANCE_AU = 0.05
// Above this count, drop the most distant/least notable ones rather than
// flooding the feed -- closest-first is the more interesting cutoff.
const MAX_EVENTS = 20

const JD_UNIX_EPOCH = 2440587.5

function julianDateToISO(jd) {
  return new Date((jd - JD_UNIX_EPOCH) * 86_400_000).toISOString()
}

function auToLunarDistances(au) {
  // 1 AU = ~389.2 lunar distances.
  return au * 389.2
}

export async function fetchEvents({ now = new Date(), windowDays = 14 } = {}) {
  const dateMin = now.toISOString().slice(0, 10)
  const dateMax = new Date(now.getTime() + windowDays * 86_400_000).toISOString().slice(0, 10)

  const url = new URL(CAD_API_URL)
  url.searchParams.set('date-min', dateMin)
  url.searchParams.set('date-max', dateMax)
  url.searchParams.set('dist-max', String(MAX_DISTANCE_AU))
  url.searchParams.set('sort', 'dist')

  const res = await fetch(url)
  if (!res.ok) throw new Error(`JPL close-approach fetch failed: ${res.status}`)
  const body = await res.json()
  const rows = (body.data ?? []).slice(0, MAX_EVENTS)

  const image = await searchCommonsImage('near-earth asteroid radar')

  const events = []
  for (const row of rows) {
    const [designation, , jd, , distAu, , , vRelKmS, , , h] = row
    const startsAt = julianDateToISO(Number(jd))
    const lunarDistances = auToLunarDistances(Number(distAu))
    const speed = Number(vRelKmS)
    // `h` (absolute magnitude) is occasionally null rather than omitted,
    // and Number(null) is 0 -- guard explicitly so a real object doesn't
    // get mislabeled as magnitude 0.0.
    const magnitude = h == null ? null : Number(h)

    events.push({
      kind: 'asteroid_approach',
      target: designation.replace(/\s+/g, '_'),
      title: `Asteroid ${designation} close approach`,
      description: `${designation} passes within ${lunarDistances.toFixed(1)} lunar distances of Earth, moving at ${speed.toFixed(1)} km/s relative to Earth.`,
      content: `Near-Earth asteroid ${designation} (absolute magnitude ${magnitude != null && Number.isFinite(magnitude) ? magnitude.toFixed(1) : 'unknown'}) makes its closest approach at roughly ${lunarDistances.toFixed(1)} times the Earth-Moon distance, travelling at about ${speed.toFixed(1)} km/s relative to Earth. Too faint for the naked eye or binoculars -- this one's for a tracked telescope exposure or just knowing it's passing by.`,
      starts_at: startsAt,
      ends_at: new Date(new Date(startsAt).getTime() + 3_600_000).toISOString(),
      image_url: image?.url ?? '',
      image_credit: image?.credit ?? 'NASA/JPL-Caltech',
    })
  }

  return events
}

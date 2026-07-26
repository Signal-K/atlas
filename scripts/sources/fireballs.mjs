// Event-source plugin: fireball (bright meteor/bolide) detections reported
// by US Government sensors, via JPL's free, keyless Fireball Data API.
// Unlike every other plugin here, this is retrospective, not predictive --
// these are real fireballs that already happened, often reported with a
// lag of days to weeks, so "windowDays" means "how far back to look" for
// newly-reported entries rather than a forward-looking prediction window.
// Treated as a global event like moon phases/asteroid approaches (no
// latitude/longitude on the event itself, even though the fireball has a
// real one) -- these are rare enough that filtering by "did this happen
// near the viewer" would hide nearly all of them. The location is worth
// knowing, so it's folded into the description text instead.
const FIREBALL_API_URL = 'https://ssd-api.jpl.nasa.gov/fireball.api'

const MAX_EVENTS = 15

// The API returns `null` for unmeasured fields (not just omitted), and
// `Number(null)` is 0 -- silently turning "unknown" into "zero" -- so every
// numeric field here goes through this guard instead of a bare Number().
function toNumberOrNull(value) {
  if (value == null) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function toSignedDegrees(value, dir) {
  const magnitude = toNumberOrNull(value)
  if (magnitude == null) return null
  return dir === 'S' || dir === 'W' ? -magnitude : magnitude
}

export async function fetchEvents({ now = new Date(), windowDays = 60 } = {}) {
  const dateMin = new Date(now.getTime() - windowDays * 86_400_000).toISOString().slice(0, 10)

  const url = new URL(FIREBALL_API_URL)
  url.searchParams.set('date-min', dateMin)
  url.searchParams.set('sort', '-date') // descending, so `limit` keeps the most recent N
  url.searchParams.set('limit', String(MAX_EVENTS))

  const res = await fetch(url)
  if (!res.ok) throw new Error(`JPL fireball fetch failed: ${res.status}`)
  const body = await res.json()
  const rows = body.data ?? []

  const events = []
  for (const row of rows) {
    const [dateStr, , impactE, lat, latDir, lon, lonDir, alt, vel] = row
    const startsAt = new Date(`${dateStr.replace(' ', 'T')}Z`)
    if (Number.isNaN(startsAt.getTime())) continue

    const latitude = toSignedDegrees(lat, latDir)
    const longitude = toSignedDegrees(lon, lonDir)
    const impactKilotons = toNumberOrNull(impactE)
    const altitudeKm = toNumberOrNull(alt)
    const speedKmS = toNumberOrNull(vel)

    const locationNote =
      latitude != null && longitude != null
        ? `near ${Math.abs(latitude).toFixed(1)}°${latitude >= 0 ? 'N' : 'S'}, ${Math.abs(longitude).toFixed(1)}°${longitude >= 0 ? 'E' : 'W'}`
        : 'location unconfirmed'

    events.push({
      kind: 'fireball',
      target: `fireball_${startsAt.getTime()}`,
      title: `Fireball detected ${locationNote}`,
      description: `A bright fireball was detected by US Government sensors ${locationNote}${impactKilotons != null ? `, releasing energy equivalent to about ${impactKilotons.toFixed(2)} kilotons of TNT` : ''}.`,
      content: `US Government sensors detected a fireball (bright meteor/bolide) ${locationNote}${altitudeKm != null ? ` at roughly ${altitudeKm.toFixed(0)} km altitude` : ''}${speedKmS != null ? `, moving at about ${speedKmS.toFixed(1)} km/s` : ''}. This already happened -- it's here as a record of real recent astronomical activity, not something to go outside for.`,
      starts_at: startsAt.toISOString(),
      ends_at: startsAt.toISOString(),
      image_url: '',
      image_credit: '',
    })
  }

  return events.slice(0, MAX_EVENTS)
}

// Event-source plugin: aurora (geomagnetic storm) alerts from NOAA SWPC's
// free 3-day planetary Kp-index forecast. Unlike ISS passes, this isn't
// city-specific -- it's a global event (no latitude/longitude set, same as
// moon phases/meteor showers) whose actual relevance depends on the
// viewer's own latitude, which the frontend doesn't know at ingest time.
// So the minimum geomagnetic latitude for visibility at this Kp is encoded
// in the `target` string (parsed back out client-side in tonightTargets.ts)
// rather than requiring a schema change for a new numeric field.
const KP_FORECAST_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json'

// Only worth surfacing from Kp 5 (minor storm) up -- below that, aurora is
// essentially never visible outside the polar circle. Values are the
// approximate equatorward edge of visibility in degrees of geomagnetic
// latitude (a well-known rule of thumb, not a precise model).
const KP_VISIBILITY_LATITUDE = { 5: 55, 6: 50, 7: 45, 8: 40, 9: 35 }
const MIN_KP = 5
const WINDOW_HOURS = 3

function latitudeThresholdFor(kp) {
  const rounded = Math.max(MIN_KP, Math.min(9, Math.floor(kp)))
  return KP_VISIBILITY_LATITUDE[rounded]
}

export async function fetchEvents({ now = new Date() } = {}) {
  const res = await fetch(KP_FORECAST_URL)
  if (!res.ok) throw new Error(`NOAA Kp forecast fetch failed: ${res.status}`)
  // Array of { time_tag, kp, observed, noaa_scale } objects (time_tag is a
  // UTC timestamp without a "Z" suffix -- ISO-parseable once appended).
  const rows = await res.json()

  const events = []
  for (const row of rows) {
    const startsAt = new Date(`${row.time_tag}Z`)
    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() < now.getTime()) continue

    const kp = Number(row.kp)
    if (!Number.isFinite(kp) || kp < MIN_KP) continue

    const latThreshold = latitudeThresholdFor(kp)
    const endsAt = new Date(startsAt.getTime() + WINDOW_HOURS * 3_600_000)

    events.push({
      kind: 'aurora',
      target: `aurora_lat${latThreshold}`,
      title: `Aurora possible tonight (Kp ${kp.toFixed(1)})`,
      description: `NOAA forecasts a Kp index of ${kp.toFixed(1)} -- aurora may be visible roughly poleward of ${latThreshold}° geomagnetic latitude.`,
      content: `A geomagnetic storm (Kp ${kp.toFixed(1)}) is forecast. If you're at or above about ${latThreshold}° latitude (north or south), look toward the poleward horizon after dark for a green or red glow -- a phone in night mode on a tripod often picks up color the naked eye can't.`,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      image_url: '',
      image_credit: 'NOAA Space Weather Prediction Center',
    })
  }

  return events
}

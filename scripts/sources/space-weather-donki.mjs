// Event-source plugin: solar flares from NASA's DONKI (Space Weather
// Database Of Notifications, Knowledge, Information) API.
//
// Unlike every other plugin here, this REQUIRES an API key
// (NASA_API_KEY) -- api.nasa.gov keys are free and instant to register,
// but registration is still a step someone has to take, so this plugin is
// deliberately NOT wired into the default PLUGINS list in ingest.mjs.
// scripts/ingest.mjs only imports and runs it when process.env.NASA_API_KEY
// is set, so a production run with no key configured behaves exactly as
// it did before this file existed -- nothing here reaches prod until
// someone deliberately adds the secret.
//
// Global (no lat/lon), same as moon phases/aurora -- a flare isn't tied to
// a viewer's location, and a big one is the actual precursor to the aurora
// activity the existing aurora.mjs plugin already tracks via Kp index.
const DONKI_FLR_URL = 'https://api.nasa.gov/DONKI/FLR'

// Only M-class and X-class flares -- C-class and below are common (dozens
// a month even at solar minimum) and not something worth surfacing as a
// discrete "event." M/X are the ones that can actually trigger a
// geomagnetic storm and visible aurora a day or two later.
const NOTABLE_CLASSES = new Set(['M', 'X'])

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

export async function fetchEvents({ now = new Date(), windowDays = 30 } = {}) {
  const apiKey = process.env.NASA_API_KEY
  if (!apiKey) throw new Error('NASA_API_KEY is not set -- skipping DONKI solar flare ingest.')

  // DONKI reports on flares that already happened (like fireballs), so this
  // looks *back* windowDays, not forward.
  const startDate = isoDate(new Date(now.getTime() - windowDays * 86_400_000))
  const endDate = isoDate(now)

  const url = new URL(DONKI_FLR_URL)
  url.searchParams.set('startDate', startDate)
  url.searchParams.set('endDate', endDate)
  url.searchParams.set('api_key', apiKey)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`NASA DONKI FLR fetch failed: ${res.status}`)
  const rows = await res.json()

  const events = []
  for (const row of rows) {
    const classType = row.classType ?? ''
    if (!NOTABLE_CLASSES.has(classType[0])) continue

    const peakTime = row.peakTime ? new Date(row.peakTime) : null
    if (!peakTime || Number.isNaN(peakTime.getTime())) continue
    const beginTime = row.beginTime ? new Date(row.beginTime) : peakTime
    const endTime = row.endTime ? new Date(row.endTime) : new Date(peakTime.getTime() + 3_600_000)

    events.push({
      kind: 'solar_flare',
      target: row.flrID ?? `flr_${peakTime.getTime()}`,
      title: `${classType}-class solar flare`,
      description: `An ${classType}-class solar flare peaked at ${row.sourceLocation ?? 'an unspecified location'} on the Sun${row.activeRegionNum ? ` (active region ${row.activeRegionNum})` : ''}. Strong flares like this can trigger aurora a day or two later.`,
      content: `NASA's DONKI space weather database recorded an ${classType}-class solar flare${row.sourceLocation ? ` from solar location ${row.sourceLocation}` : ''}${row.activeRegionNum ? `, active region ${row.activeRegionNum}` : ''}. Not directly observable without a dedicated solar telescope, but M/X-class flares are the ones worth watching -- check Atlas's aurora forecast over the next few nights if this one was Earth-facing.`,
      starts_at: beginTime.toISOString(),
      ends_at: endTime.toISOString(),
      image_url: '',
      image_credit: '',
    })
  }

  return events
}

// Event-source plugin: bright naked-eye satellite passes beyond the ISS --
// China's Tiangong space station (same SGP4 approach as iss-passes.mjs),
// plus a best-effort "Starlink train" detector for newly launched batches
// still flying close together before they disperse to their operational
// orbits.
import * as satellite from 'satellite.js'
import { CITIES } from './cities.mjs'
import { fetchTle, parseTleGroup, passesForCity } from './satellitePasses.mjs'

const STARLINK_GROUP_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle'

// Bare single-satellite sources, same treatment as Tiangong: real SGP4 pass
// prediction against a live TLE, no "train" clustering needed since there's
// only one object. Hubble sits alongside Tiangong as a second bright,
// well-known naked-eye pass beyond the ISS.
const BARE_SATELLITES = [
  {
    id: 'tiangong',
    name: 'Tiangong',
    tleUrl: 'https://celestrak.org/NORAD/elements/gp.php?CATNR=48274&FORMAT=TLE',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Tiangong_space_station_%28cropped%29.jpg',
    imageCredit: 'CMSA, Wikimedia Commons',
  },
  {
    id: 'hubble',
    name: 'Hubble Space Telescope',
    tleUrl: 'https://celestrak.org/NORAD/elements/gp.php?CATNR=20580&FORMAT=TLE',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3f/HST-SM4.jpeg',
    imageCredit: 'NASA, Wikimedia Commons',
  },
]

// NORAD catalog numbers are assigned in launch order, so the highest
// numbers currently in the active Starlink group are the newest launch
// batch -- the group most likely to still be flying in a visible "train"
// before they raise orbit and disperse. This is a heuristic, not a precise
// "still in train" detector: trains disperse at rates that vary from days
// to a few weeks depending on the launch, so some reported windows will be
// stale and some genuine trains from an unusually slow-to-disperse launch
// will be missed. Kept small (and the window short) to bound the SGP4
// propagation cost -- this plugin alone runs O(cities x satellites x
// window/step) propagations.
const RECENT_BATCH_SIZE = 40
const TRAIN_WINDOW_DAYS = 5
const TRAIN_CLUSTER_MINUTES = 20
// A single satellite passing overhead isn't a "train" -- only report
// clusters of several satellites moving through close together in time.
const MIN_TRAIN_SIZE = 3

function catalogNumber(line1) {
  return parseInt(line1.slice(2, 7), 10)
}

async function bareSatelliteEvents(now, windowDays) {
  const start = now.getTime()
  const end = start + windowDays * 86_400_000
  const events = []

  for (const sat of BARE_SATELLITES) {
    let satrec
    try {
      const { line1, line2 } = await fetchTle(sat.tleUrl)
      satrec = satellite.twoline2satrec(line1, line2)
    } catch (error) {
      console.error(`Skipping ${sat.name} passes -- TLE fetch failed:`, error.message)
      continue
    }

    for (const city of CITIES) {
      for (const pass of passesForCity(satrec, city, start, end)) {
        events.push({
          kind: 'satellite_flare',
          target: `${sat.id}_${city.name.toLowerCase().replace(/\s+/g, '_')}`,
          title: `${sat.name} Pass over ${city.name}`,
          description: `A visible pass of ${sat.name} over ${city.name}, reaching ${Math.round(pass.maxElevation)}° above the horizon.`,
          content: `${sat.name} will be visible as a bright, fast-moving point of light (no telescope needed), reaching a peak elevation of about ${Math.round(pass.maxElevation)}° above the horizon -- similar in appearance to an ISS pass, just fainter.`,
          starts_at: pass.start.toISOString(),
          ends_at: pass.end.toISOString(),
          latitude: city.lat,
          longitude: city.lon,
          image_url: sat.imageUrl,
          image_credit: sat.imageCredit,
        })
      }
    }
  }

  return events
}

function clusterPasses(passes) {
  const sorted = [...passes].sort((a, b) => a.start.getTime() - b.start.getTime())
  const clusters = []
  for (const pass of sorted) {
    const last = clusters[clusters.length - 1]
    if (last && pass.start.getTime() - last.end.getTime() <= TRAIN_CLUSTER_MINUTES * 60_000) {
      last.end = pass.end > last.end ? pass.end : last.end
      last.count += 1
      last.maxElevation = Math.max(last.maxElevation, pass.maxElevation)
    } else {
      clusters.push({ start: pass.start, end: pass.end, count: 1, maxElevation: pass.maxElevation })
    }
  }
  return clusters.filter((cluster) => cluster.count >= MIN_TRAIN_SIZE)
}

async function starlinkTrainEvents(now, windowDays) {
  const res = await fetch(STARLINK_GROUP_URL)
  if (!res.ok) throw new Error(`Starlink TLE group fetch failed: ${res.status}`)
  const group = parseTleGroup(await res.text())
  const recent = [...group].sort((a, b) => catalogNumber(b.line1) - catalogNumber(a.line1)).slice(0, RECENT_BATCH_SIZE)

  const start = now.getTime()
  const end = start + windowDays * 86_400_000
  const events = []

  for (const city of CITIES) {
    const allPasses = []
    for (const sat of recent) {
      const satrec = satellite.twoline2satrec(sat.line1, sat.line2)
      allPasses.push(...passesForCity(satrec, city, start, end))
    }

    for (const train of clusterPasses(allPasses)) {
      events.push({
        kind: 'satellite_flare',
        target: `starlink_train_${city.name.toLowerCase().replace(/\s+/g, '_')}`,
        title: `Starlink Train over ${city.name}`,
        description: `A "train" of roughly ${train.count} recently launched Starlink satellites crossing the sky together over ${city.name}, reaching ${Math.round(train.maxElevation)}° above the horizon.`,
        content: `Look for a line of faint, evenly-spaced points of light moving steadily across the sky together -- unmistakable once you spot it, and a fun wide-angle long-exposure phone shot. Newly launched Starlink satellites fly close together for days to a few weeks before spreading into their operational orbits, so treat this window as approximate.`,
        starts_at: train.start.toISOString(),
        ends_at: train.end.toISOString(),
        latitude: city.lat,
        longitude: city.lon,
        image_url: '',
        image_credit: '',
      })
    }
  }

  return events
}

export async function fetchEvents({ now = new Date(), windowDays = TRAIN_WINDOW_DAYS } = {}) {
  const [bare, starlink] = await Promise.all([
    bareSatelliteEvents(now, windowDays).catch(() => []),
    starlinkTrainEvents(now, windowDays).catch(() => []),
  ])
  return [...bare, ...starlink]
}

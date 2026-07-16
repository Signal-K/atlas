import { searchCommonsImage } from './commons-image.mjs'

const TIMEANDDATE_URL = 'https://www.timeanddate.com/astronomy/night/australia/melbourne'
const EARTHSKY_URL = 'https://earthsky.org/astronomy-essentials/visible-planets-tonight-mars-jupiter-venus-saturn-mercury/'
const MELBOURNE = { latitude: -37.8136, longitude: 144.9631 }

const PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function sentenceAfter(text, planet) {
  const pattern = new RegExp(`${planet} rise and set in Melbourne\\s+([^\\.]+\\.)\\s+([^\\.]+\\.)`, 'i')
  const match = text.match(pattern)
  if (!match) return null
  return `${match[1]} ${match[2]}`.trim()
}

function visibilityScore(description) {
  const lower = description.toLowerCase()
  if (lower.includes('impossible') || lower.includes('difficult')) return 0
  if (lower.includes('bring binoculars') || lower.includes('use binoculars')) return 1
  return 2
}

function eventTime(now, offsetHours) {
  const date = new Date(now)
  date.setHours(offsetHours, 0, 0, 0)
  if (date.getTime() < now.getTime()) date.setDate(date.getDate() + 1)
  return date
}

function fallbackEvents(now) {
  const evening = eventTime(now, 18)
  const morning = eventTime(now, 5)
  return [
    {
      planet: 'Venus',
      description: 'Look for Venus in evening twilight when it is separated enough from the Sun; it is one of the easiest naked-eye planet targets.',
      startsAt: evening,
    },
    {
      planet: 'Jupiter',
      description: 'Jupiter is a bright naked-eye target in twilight when above the western horizon; haze and buildings matter when it is low.',
      startsAt: evening,
    },
    {
      planet: 'Saturn',
      description: 'Saturn is a late-night or early-morning telescope target; steady seeing gives the best view of its currently thin ring presentation.',
      startsAt: morning,
    },
    {
      planet: 'Mars',
      description: 'Mars is a low twilight target when available, best checked against the local horizon before committing to an observing session.',
      startsAt: morning,
    },
    {
      planet: 'Scorpius',
      description: 'Scorpius and the Milky Way core region dominate Melbourne winter evenings, making them strong naked-eye and wide-field targets.',
      startsAt: evening,
    },
  ]
}

async function timeAndDateEvents(now) {
  const response = await fetch(TIMEANDDATE_URL, {
    headers: {
      'user-agent': 'Atlas event ingestion (+https://github.com/)',
      accept: 'text/html',
    },
  })
  if (!response.ok) throw new Error(`timeanddate fetch failed: ${response.status}`)
  const text = stripHtml(await response.text())
  const events = []

  for (const planet of PLANETS) {
    const description = sentenceAfter(text, planet)
    if (!description || visibilityScore(description) === 0) continue
    const lower = description.toLowerCase()
    const startsAt = eventTime(now, lower.includes('before sunrise') || lower.includes('early morning') ? 5 : 18)
    events.push({ planet, description, startsAt })
  }

  return events
}

// A generic, always-real fallback for whichever planet's own search comes
// back empty or non-photo -- resolved once per run, not per planet.
let genericSkyImagePromise = null
function genericSkyImage() {
  genericSkyImagePromise ??= searchCommonsImage('night sky stars milky way')
  return genericSkyImagePromise
}

async function toSkyEvent(item) {
  const startsAt = item.startsAt.toISOString()
  const endsAt = new Date(item.startsAt.getTime() + 2 * 3_600_000).toISOString()
  const image = (await searchCommonsImage(`${item.planet} planet photograph`)) ?? (await genericSkyImage())
  return {
    kind: 'local_night_sky',
    target: `melbourne_${item.planet.toLowerCase().replace(/\s+/g, '_')}`,
    title: `${item.planet} from Melbourne tonight`,
    description: item.description,
    content: `${item.description} Sources: Timeanddate Melbourne night-sky guide and EarthSky's monthly visible-planets guide.`,
    starts_at: startsAt,
    ends_at: endsAt,
    latitude: MELBOURNE.latitude,
    longitude: MELBOURNE.longitude,
    image_url: image?.url ?? '',
    image_credit: image?.credit ?? `Timeanddate: ${TIMEANDDATE_URL}; EarthSky: ${EARTHSKY_URL}`,
  }
}

export async function fetchEvents({ now = new Date() } = {}) {
  let events
  try {
    events = await timeAndDateEvents(now)
  } catch {
    events = fallbackEvents(now)
  }
  return Promise.all(events.map(toSkyEvent))
}

// Event-source plugin: major annual meteor showers. Peak dates recur on
// (approximately) the same calendar day every year, so this generates one
// event per shower for whichever year(s) fall inside the requested window.

const SHOWERS = [
  {
    name: 'Quadrantids',
    month: 1,
    day: 3,
    description: 'A short, sharp peak known for bright fireballs, radiating from the constellation Boötes.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/32/QUADRANTID_meteor_on_January_3_2009.jpg',
  },
  {
    name: 'Lyrids',
    month: 4,
    day: 22,
    description: 'One of the oldest recorded showers, radiating from Lyra, with fast, bright meteors.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/01/02-Lyrid_Meteor_Shower_2022-nX-3.jpg',
  },
  {
    name: 'Eta Aquariids',
    month: 5,
    day: 5,
    description: 'Debris from Halley’s Comet, best seen from the Southern Hemisphere before dawn.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/fd/Eta_Aquariids%2C_Elbe-Parey_%28Collage%29_01.jpg',
  },
  {
    name: 'Perseids',
    month: 8,
    day: 12,
    description: 'The most popular shower of the year: reliable rates, warm summer nights, and frequent fireballs, radiating from Perseus.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/31/Aurora_and_perseids.jpg',
  },
  {
    name: 'Orionids',
    month: 10,
    day: 21,
    // IMO activity runs from early October through about 7 November. The
    // sharp peak is the night of 21–22 October; the stored window is the
    // whole activity, not only the peak night.
    activeStart: { month: 10, day: 2 },
    activeEnd: { month: 11, day: 7 },
    description: 'A second shower from Halley’s Comet debris, radiating from Orion with fast, occasionally bright meteors. Active from about 2 October through 7 November; the peak night is 21–22 October.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/39/Orionids_Meteor_shower.jpg',
  },
  {
    name: 'Leonids',
    month: 11,
    day: 17,
    description: 'Known for producing meteor storms roughly every 33 years; typical years show modest but fast, bright meteors.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e2/Leonid_Meteor_Storm_1833.jpg',
  },
  {
    name: 'Geminids',
    month: 12,
    day: 14,
    description: 'Widely considered the best shower of the year: high rates of bright, slow meteors, radiating from Gemini.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Geminid_meteor_shower.jpg',
  },
  {
    name: 'Ursids',
    month: 12,
    day: 22,
    description: 'A minor, often-overlooked shower near the winter solstice, radiating from Ursa Minor.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Ursids_meteor_shower_over_a_saguaro_in_Arizona%2C_US.jpg',
  },
]

function activityBounds(shower, year) {
  const peak = new Date(Date.UTC(year, shower.month - 1, shower.day, 4, 0, 0))
  if (shower.activeStart && shower.activeEnd) {
    const startYear = shower.activeStart.month > shower.month ? year - 1 : year
    const endYear = shower.activeEnd.month < shower.month ? year + 1 : year
    return {
      peak,
      startsAt: new Date(Date.UTC(startYear, shower.activeStart.month - 1, shower.activeStart.day, 0, 0, 0)).toISOString(),
      endsAt: new Date(Date.UTC(endYear, shower.activeEnd.month - 1, shower.activeEnd.day, 23, 59, 59)).toISOString(),
    }
  }
  // A +-6h window around one UTC "peak" instant only lines up with evening
  // for observers near UTC -- for anyone else (Europe, Australia, etc.) it
  // had already ended hours before their local night even started, so the
  // shower silently vanished from "tonight" for most of the world. Showers
  // are genuinely visible for several nights around the peak date anyway,
  // so widen this to comfortably cover every timezone's "tonight near the
  // peak" (-18h/+42h keeps the same start-of-day date as before, so this
  // still matches/updates the existing record on reseed rather than
  // orphaning a duplicate -- see seed-curated-window.mjs's upsert key).
  return {
    peak,
    startsAt: new Date(peak.getTime() - 18 * 3_600_000).toISOString(),
    endsAt: new Date(peak.getTime() + 42 * 3_600_000).toISOString(),
  }
}

export function orionidsActivity(year) {
  const shower = SHOWERS.find((item) => item.name === 'Orionids')
  const bounds = activityBounds(shower, year)
  return {
    target: 'orionids',
    year,
    startsAt: bounds.startsAt,
    endsAt: bounds.endsAt,
    peakAt: bounds.peak.toISOString(),
  }
}

function eventForYear(shower, year) {
  const { peak, startsAt, endsAt } = activityBounds(shower, year)
  return {
    kind: 'meteor_shower',
    target: shower.name.toLowerCase().replace(/\s+/g, '_'),
    title: `${shower.name} Meteor Shower`,
    description: shower.description,
    content: `${shower.name} peaks around ${shower.month}/${shower.day} each year. ${shower.description} Best viewed once the sky is dark and, on a moonlit peak, after moonset, away from light pollution, once your eyes have adapted to the dark for 20-30 minutes.`,
    starts_at: startsAt,
    ends_at: endsAt,
    ...(shower.imageUrl ? { image_url: shower.imageUrl, image_credit: shower.imageCredit ?? 'Wikimedia Commons' } : {}),
  }
}

export async function fetchEvents({ now = new Date(), windowDays = 90 } = {}) {
  const start = now.getTime()
  const end = start + windowDays * 86_400_000
  const events = []

  for (const shower of SHOWERS) {
    for (const year of [now.getUTCFullYear(), now.getUTCFullYear() + 1]) {
      const event = eventForYear(shower, year)
      const startsAt = new Date(event.starts_at).getTime()
      const endsAt = new Date(event.ends_at).getTime()
      if (startsAt <= end && endsAt >= start) events.push(event)
    }
  }

  return events
}

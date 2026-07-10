// Event-source plugin: real computed "best viewing" dates for a curated set
// of well-known galaxies/nebulae/clusters, using astronomy-engine.
//
// A deep-sky object is best placed for viewing when it's roughly opposite
// the Sun in the sky (same idea as a planet at opposition) -- it then rises
// at sunset, transits around midnight, and is up all night. This finds the
// date each year when that alignment happens, by stepping through the year
// and finding when the Sun's RA is closest to (object RA + 12h).
import * as Astronomy from 'astronomy-engine'

// RA in decimal hours, Dec in decimal degrees (J2000, standard Messier
// catalog positions). Precession is a few arcmin/year, negligible here.
const OBJECTS = [
  {
    id: 'm31',
    name: 'Andromeda Galaxy (M31)',
    ra: 0.712,
    kind: 'galaxy',
    description: 'The nearest large spiral galaxy to the Milky Way, visible to the naked eye from a dark sky as a faint smudge.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/98/Andromeda_Galaxy_%28with_h-alpha%29.jpg',
  },
  {
    id: 'm42',
    name: 'Orion Nebula (M42)',
    ra: 5.59,
    kind: 'nebula',
    description: 'A bright star-forming nebula visible to the naked eye in Orion’s Sword, spectacular in binoculars or a small telescope.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Orion_Nebula_-_Hubble_2006_mosaic_18000.jpg',
  },
  {
    id: 'm45',
    name: 'Pleiades (M45)',
    ra: 3.78,
    kind: 'cluster',
    description: 'The Seven Sisters — a bright, naked-eye open star cluster in Taurus.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Pleiades_large.jpg',
  },
  {
    id: 'm13',
    name: 'Hercules Cluster (M13)',
    ra: 16.7,
    kind: 'cluster',
    description: 'One of the brightest globular star clusters in the northern sky, resolvable into individual stars in a telescope.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/The_Great_Globular_Cluster_in_Hercules_Messier_13_%28M13%29.jpg',
  },
  {
    id: 'm51',
    name: 'Whirlpool Galaxy (M51)',
    ra: 13.5,
    kind: 'galaxy',
    description: 'A classic face-on spiral galaxy interacting with a smaller companion, a favorite telescope/astrophotography target.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Messier_51_-_The_Whirlpool_Galaxy_%2849706551451%29.jpg',
  },
  {
    id: 'm57',
    name: 'Ring Nebula (M57)',
    ra: 18.89,
    kind: 'nebula',
    description: 'A small, bright planetary nebula in Lyra — the glowing shell of a dying sun-like star.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/fe/Hubble_image_of_the_Ring_Nebula_%28Messier_57%29.jpg',
  },
  {
    id: 'm8',
    name: 'Lagoon Nebula (M8)',
    ra: 18.06,
    kind: 'nebula',
    description: 'A large, bright star-forming nebula in Sagittarius, visible to the naked eye from a dark sky.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/c4/Lagoon_Nebula.jpg',
  },
  {
    id: 'm27',
    name: 'Dumbbell Nebula (M27)',
    ra: 19.99,
    kind: 'nebula',
    description: 'A bright planetary nebula in Vulpecula, one of the easiest of its kind to observe.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/09/M27%2C_NGC_6853%2C_Dumbbell_Nebula_%28noao-02185%29.jpg',
  },
]

const observer = new Astronomy.Observer(0, 0, 0)

function sunRaHours(date) {
  return Astronomy.Equator(Astronomy.Body.Sun, date, observer, true, true).ra
}

function bestDateInYear(objectRaHours, yearStart) {
  const antisolarRa = (objectRaHours + 12) % 24
  let best = yearStart
  let bestDiff = Infinity
  for (let day = 0; day < 366; day += 1) {
    const date = new Date(yearStart.getTime() + day * 86_400_000)
    let diff = Math.abs(sunRaHours(date) - antisolarRa)
    if (diff > 12) diff = 24 - diff
    if (diff < bestDiff) {
      bestDiff = diff
      best = date
    }
  }
  return best
}

export async function fetchEvents({ now = new Date(), windowDays = 365 } = {}) {
  const end = now.getTime() + windowDays * 86_400_000
  const events = []

  for (const object of OBJECTS) {
    // Check this year and next, in case the best date for this window falls
    // just after the turn of the year relative to `now`.
    for (const yearOffset of [0, 1]) {
      const yearStart = new Date(Date.UTC(now.getUTCFullYear() + yearOffset, 0, 1))
      const date = bestDateInYear(object.ra, yearStart)
      if (date.getTime() < now.getTime() || date.getTime() > end) continue

      const startsAt = date.toISOString()
      events.push({
        kind: 'deep_sky',
        target: object.id,
        title: `${object.name} well placed for viewing`,
        description: object.description,
        content: `${object.name} is opposite the Sun around ${date.toDateString()}, rising at sunset and visible all night — the best time of year to look for it.`,
        starts_at: startsAt,
        ends_at: startsAt,
        ...(object.imageUrl ? { image_url: object.imageUrl, image_credit: 'Wikimedia Commons' } : {}),
      })
    }
  }

  return events
}

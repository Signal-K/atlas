// Event-source plugin: real computed planetary events via astronomy-engine
// -- oppositions of the outer planets (best/brightest viewing, up all night)
// and greatest elongations of Mercury/Venus (furthest from the Sun's glare,
// best viewing as a morning/evening "star").
import * as Astronomy from 'astronomy-engine'
import { PLANET_IMAGES } from './planet-images.mjs'

const OPPOSITION_BODIES = ['Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']
const ELONGATION_BODIES = ['Mercury', 'Venus']

function oppositionEvents(now, end) {
  const events = []
  for (const bodyName of OPPOSITION_BODIES) {
    let cursor = now
    // Superior planets reach opposition roughly once a year (out to ~30 years
    // for the outer planets), so a handful of iterations comfortably covers
    // any realistic ingest window without an unbounded loop.
    for (let i = 0; i < 5; i += 1) {
      const time = Astronomy.SearchRelativeLongitude(Astronomy.Body[bodyName], 0, cursor)
      if (time.date.getTime() > end) break
      if (time.date.getTime() >= now.getTime()) {
        const startsAt = time.date.toISOString()
        events.push({
          kind: 'planet_event',
          target: bodyName.toLowerCase(),
          title: `${bodyName} at Opposition`,
          description: `${bodyName} is opposite the Sun in the sky — up all night and at its brightest and largest for the year.`,
          content: `${bodyName} rises at sunset and is visible all night, reaching its highest point around midnight. This is the best time of year to observe ${bodyName}, whether with the naked eye, binoculars, or a telescope.`,
          starts_at: startsAt,
          ends_at: startsAt,
          image_url: PLANET_IMAGES[bodyName].url,
          image_credit: PLANET_IMAGES[bodyName].credit,
        })
      }
      cursor = new Date(time.date.getTime() + 86_400_000)
    }
  }
  return events
}

function elongationEvents(now, end) {
  const events = []
  for (const bodyName of ELONGATION_BODIES) {
    let cursor = now
    for (let i = 0; i < 8; i += 1) {
      const event = Astronomy.SearchMaxElongation(Astronomy.Body[bodyName], cursor)
      if (event.time.date.getTime() > end) break
      if (event.time.date.getTime() >= now.getTime()) {
        const startsAt = event.time.date.toISOString()
        const when = event.visibility === 'morning' ? 'before sunrise' : 'after sunset'
        events.push({
          kind: 'planet_event',
          target: bodyName.toLowerCase(),
          title: `${bodyName} at Greatest Elongation`,
          description: `${bodyName} reaches its greatest angular separation (${event.elongation.toFixed(0)}°) from the Sun, visible in the ${event.visibility} sky.`,
          content: `${bodyName} is as far from the Sun's glare as it gets this apparition (${event.elongation.toFixed(0)}° separation) — the best window to spot it low in the ${when} sky.`,
          starts_at: startsAt,
          ends_at: startsAt,
          image_url: PLANET_IMAGES[bodyName].url,
          image_credit: PLANET_IMAGES[bodyName].credit,
        })
      }
      cursor = new Date(event.time.date.getTime() + 86_400_000)
    }
  }
  return events
}

export async function fetchEvents({ now = new Date(), windowDays = 365 } = {}) {
  const end = now.getTime() + windowDays * 86_400_000
  return [...oppositionEvents(now, end), ...elongationEvents(now, end)]
}

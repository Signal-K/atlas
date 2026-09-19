#!/usr/bin/env node
// Builds one finite, canonical astronomy catalogue for the next 14 days.
// This deliberately excludes city-specific ISS/Starlink predictions and
// volatile forecasts: those are opt-in utilities, not primary sky events.

import PocketBase from 'pocketbase'
// The five deterministic generators live in src/lib/eventSources/, not
// scripts/sources/, because the past-check-in matcher generates historical
// days from the exact same definitions. They are imported here rather than
// duplicated: two copies would drift, and the drift would be invisible --
// the seed would keep writing correct forward windows while the matcher
// quietly diverged. asteroid-approaches stays local: it needs live JPL data
// and cannot be reconstructed for a past date.
import { fetchEvents as fetchMoonPhaseEvents } from '../src/lib/eventSources/moon-phase.mjs'
import { fetchEvents as fetchMeteorShowerEvents } from '../src/lib/eventSources/meteor-showers.mjs'
import { fetchEvents as fetchEclipseEvents } from '../src/lib/eventSources/eclipses.mjs'
import { fetchEvents as fetchPlanetEvents } from '../src/lib/eventSources/planets.mjs'
import { fetchEvents as fetchConjunctionEvents } from '../src/lib/eventSources/conjunctions.mjs'
import { fetchEvents as fetchAsteroidApproachEvents } from './sources/asteroid-approaches.mjs'
import { canonicalKey, dateKeyOf as dateKey, isInCuratedWindow } from '../src/lib/eventSources/canonical.mjs'

// Re-exported so existing callers and tests keep importing them from here.
export { canonicalKey, isInCuratedWindow }

export const CURATED_WINDOW_DAYS = 14

const SOURCES = [
  { id: 'astronomy-engine-moon', label: 'Astronomy Engine lunar ephemeris', url: 'https://github.com/cosinekitty/astronomy', fetch: fetchMoonPhaseEvents },
  { id: 'imo-meteor-calendar', label: 'International Meteor Organization shower calendar', url: 'https://www.imo.net/resources/calendar/', fetch: fetchMeteorShowerEvents },
  { id: 'astronomy-engine-eclipses', label: 'Astronomy Engine eclipse ephemeris', url: 'https://github.com/cosinekitty/astronomy', fetch: fetchEclipseEvents },
  { id: 'astronomy-engine-planets', label: 'Astronomy Engine planetary ephemeris', url: 'https://github.com/cosinekitty/astronomy', fetch: fetchPlanetEvents },
  { id: 'astronomy-engine-conjunctions', label: 'Astronomy Engine conjunction calculation', url: 'https://github.com/cosinekitty/astronomy', fetch: fetchConjunctionEvents },
  { id: 'jpl-cad', label: 'NASA JPL Small-Body Database close-approach data', url: 'https://ssd-api.jpl.nasa.gov/doc/cad.html', fetch: fetchAsteroidApproachEvents },
]

function escapeFilter(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

function withProvenance(event, source) {
  const sourceNote = `\n\nData source: ${source.label} (${source.url}).`
  return { ...event, content: `${event.content ?? event.description}${sourceNote}` }
}

export async function buildCuratedWindow({ now = new Date(), windowDays = CURATED_WINDOW_DAYS } = {}) {
  const candidates = []
  const sourceFailures = []

  for (const source of SOURCES) {
    try {
      const events = await source.fetch({ now, windowDays })
      for (const event of events) {
        if (isInCuratedWindow(event, { now, windowDays })) candidates.push(withProvenance(event, source))
      }
    } catch (error) {
      sourceFailures.push({ source: source.id, error: error instanceof Error ? error.message : String(error) })
    }
  }

  const byKey = new Map()
  for (const event of candidates) {
    const key = canonicalKey(event)
    // The curated source order is intentional. It makes a collision stable
    // and reviewable rather than allowing the last API response to win.
    if (!byKey.has(key)) byKey.set(key, event)
  }
  return { events: [...byKey.values()].sort((a, b) => a.starts_at.localeCompare(b.starts_at)), sourceFailures }
}

async function upsertCanonical(pb, event) {
  const key = canonicalKey(event)
  const filter = `kind = "${escapeFilter(event.kind)}" && target = "${escapeFilter(event.target)}"`
  const matches = await pb.collection('sky_events').getFullList({ filter, sort: '+starts_at' })
  const sameEvent = matches.filter((record) => dateKey(record.starts_at) === dateKey(event.starts_at))
  if (sameEvent.length === 0) {
    await pb.collection('sky_events').create(event)
    return { key, action: 'created', duplicatesRemoved: 0 }
  }

  await pb.collection('sky_events').update(sameEvent[0].id, event)
  for (const duplicate of sameEvent.slice(1)) await pb.collection('sky_events').delete(duplicate.id)
  return { key, action: 'updated', duplicatesRemoved: Math.max(0, sameEvent.length - 1) }
}

export async function seedCuratedWindow({ now = new Date(), windowDays = CURATED_WINDOW_DAYS, apply = false } = {}) {
  const catalogue = await buildCuratedWindow({ now, windowDays })
  if (!apply) return { ...catalogue, created: 0, updated: 0, duplicatesRemoved: 0 }

  const email = process.env.PB_ADMIN_EMAIL
  const password = process.env.PB_ADMIN_PASSWORD
  if (!email || !password) throw new Error('PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD are required for --apply.')

  const pb = new PocketBase(process.env.PB_URL ?? 'http://127.0.0.1:8090')
  await pb.collection('_superusers').authWithPassword(email, password)
  let created = 0
  let updated = 0
  let duplicatesRemoved = 0
  for (const event of catalogue.events) {
    const result = await upsertCanonical(pb, event)
    if (result.action === 'created') created += 1
    else updated += 1
    duplicatesRemoved += result.duplicatesRemoved
  }
  return { ...catalogue, created, updated, duplicatesRemoved }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const result = await seedCuratedWindow({ apply })
  const report = {
    mode: apply ? 'applied' : 'dry-run',
    windowDays: CURATED_WINDOW_DAYS,
    events: result.events.map((event) => ({ canonicalKey: canonicalKey(event), title: event.title, startsAt: event.starts_at })),
    sourceFailures: result.sourceFailures,
    created: result.created,
    updated: result.updated,
    duplicatesRemoved: result.duplicatesRemoved,
  }
  console.log(JSON.stringify(report, null, 2))
  if (result.sourceFailures.length) process.exitCode = 1
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error) => { console.error(error); process.exit(1) })

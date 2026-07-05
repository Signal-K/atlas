#!/usr/bin/env node
// Runs every registered event-source plugin and upserts the results into the
// shared PocketBase `sky_events` collection. Invoked by GitHub Actions on a
// schedule (AT-010) or manually: `node scripts/ingest.mjs`.

import PocketBase from 'pocketbase'
import { fetchEvents as fetchMoonPhaseEvents } from './sources/moon-phase.mjs'
import { fetchEvents as fetchMeteorShowerEvents } from './sources/meteor-showers.mjs'
import { fetchEvents as fetchEclipseEvents } from './sources/eclipses.mjs'
import { fetchEvents as fetchIssPassEvents } from './sources/iss-passes.mjs'

// Each plugin gets its own sensible window: moon phases/meteor showers/
// eclipses are predictable a year out, but ISS pass predictions go stale
// fast (TLE drift), so that one intentionally stays short (its own default).
const PLUGINS = [
  { fetch: fetchMoonPhaseEvents, windowDays: 365 },
  { fetch: fetchMeteorShowerEvents, windowDays: 365 },
  { fetch: fetchEclipseEvents, windowDays: 365 },
  { fetch: fetchIssPassEvents },
]

const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090'
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD

async function upsert(pb, event) {
  // PocketBase stores/returns dates space-separated ("YYYY-MM-DD HH:MM:SS.sssZ"),
  // not ISO-with-"T" — an exact-match filter using the "T" form never matches,
  // which silently created duplicates on every re-run until this was caught.
  const startsAtStored = event.starts_at.replace('T', ' ')
  const filter = `kind = "${event.kind}" && target = "${event.target}" && starts_at = "${startsAtStored}"`
  const existing = await pb.collection('sky_events').getFullList({ filter })
  if (existing.length > 0) {
    // Update rather than skip, so re-running the ingest backfills new
    // fields (like content/image_url) onto events seeded before they existed.
    await pb.collection('sky_events').update(existing[0].id, event)
    return { event, action: 'updated' }
  }
  await pb.collection('sky_events').create(event)
  return { event, action: 'created' }
}

async function main() {
  if (!PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD) {
    console.error('PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD env vars are required.')
    process.exit(1)
  }

  const pb = new PocketBase(PB_URL)
  await pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD)

  const now = new Date()
  let created = 0
  let updated = 0

  for (const { fetch: plugin, windowDays } of PLUGINS) {
    const events = await plugin(windowDays ? { now, windowDays } : { now })
    for (const event of events) {
      const result = await upsert(pb, event)
      if (result.action === 'created') created += 1
      else updated += 1
    }
  }

  console.log(`Ingest complete: ${created} created, ${updated} updated.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

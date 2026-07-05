#!/usr/bin/env node
// Runs every registered event-source plugin and upserts the results into the
// shared PocketBase `sky_events` collection. Invoked by GitHub Actions on a
// schedule (AT-010) or manually: `node scripts/ingest.mjs`.

import PocketBase from 'pocketbase'
import { fetchEvents as fetchMoonPhaseEvents } from './sources/moon-phase.mjs'

const PLUGINS = [fetchMoonPhaseEvents]

const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090'
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD

async function upsert(pb, event) {
  const filter = `kind = "${event.kind}" && target = "${event.target}" && starts_at = "${event.starts_at}"`
  const existing = await pb.collection('sky_events').getFullList({ filter })
  if (existing.length > 0) {
    return { event, action: 'skipped' }
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
  let skipped = 0

  for (const plugin of PLUGINS) {
    const events = await plugin({ now })
    for (const event of events) {
      const result = await upsert(pb, event)
      if (result.action === 'created') created += 1
      else skipped += 1
    }
  }

  console.log(`Ingest complete: ${created} created, ${skipped} already present.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

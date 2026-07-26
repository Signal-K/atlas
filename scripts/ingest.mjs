#!/usr/bin/env node
// Runs every registered event-source plugin and upserts the results into the
// shared PocketBase `sky_events` collection. Invoked by GitHub Actions on a
// schedule (AT-010) or manually: `node scripts/ingest.mjs`.

import PocketBase from 'pocketbase'
import { fetchEvents as fetchMoonPhaseEvents } from './sources/moon-phase.mjs'
import { fetchEvents as fetchMeteorShowerEvents } from './sources/meteor-showers.mjs'
import { fetchEvents as fetchEclipseEvents } from './sources/eclipses.mjs'
import { fetchEvents as fetchIssPassEvents } from './sources/iss-passes.mjs'
import { fetchEvents as fetchPlanetEvents } from './sources/planets.mjs'
import { fetchEvents as fetchDeepSkyEvents } from './sources/deep-sky-objects.mjs'
import { fetchEvents as fetchConjunctionEvents } from './sources/conjunctions.mjs'
import { fetchEvents as fetchMelbourneNightSkyEvents } from './sources/melbourne-night-sky.mjs'
import { fetchEvents as fetchSatelliteFlareEvents } from './sources/satellite-flares.mjs'
import { fetchEvents as fetchAuroraEvents } from './sources/aurora.mjs'
import { fetchEvents as fetchCometEvents } from './sources/comets.mjs'
import { fetchEvents as fetchAsteroidApproachEvents } from './sources/asteroid-approaches.mjs'
import { fetchEvents as fetchFireballEvents } from './sources/fireballs.mjs'

// Each plugin gets its own sensible window: moon phases/meteor showers/
// eclipses/planets/deep-sky/conjunctions are predictable a year out, but ISS
// and other satellite pass predictions go stale fast (TLE drift), aurora
// forecasts only exist a few days out, and the comet tracker link doesn't
// need a window at all -- so those intentionally stay short (their own
// defaults). Asteroid close approaches are only usefully precise a couple
// weeks out; fireballs are retrospective (see fireballs.mjs), so windowDays
// there means "how far back" rather than "how far forward".
const PLUGINS = [
  { fetch: fetchMoonPhaseEvents, windowDays: 365 },
  { fetch: fetchMeteorShowerEvents, windowDays: 365 },
  { fetch: fetchEclipseEvents, windowDays: 365 },
  { fetch: fetchPlanetEvents, windowDays: 365 },
  { fetch: fetchDeepSkyEvents, windowDays: 365 },
  { fetch: fetchConjunctionEvents, windowDays: 365 },
  { fetch: fetchMelbourneNightSkyEvents },
  { fetch: fetchIssPassEvents },
  { fetch: fetchSatelliteFlareEvents },
  { fetch: fetchAuroraEvents },
  { fetch: fetchCometEvents },
  { fetch: fetchAsteroidApproachEvents, windowDays: 14 },
  { fetch: fetchFireballEvents, windowDays: 60 },
]

const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090'
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD

async function upsert(pb, event) {
  // A tolerant time window rather than an exact match, for two reasons:
  // (1) PocketBase stores/returns dates space-separated ("YYYY-MM-DD
  // HH:MM:SS.sssZ"), not ISO-with-"T", so an exact "T"-form match never
  // worked in the first place; (2) plugins that fetch live data (ISS passes
  // against a live TLE) recompute slightly different timestamps run to run
  // as the source data refreshes, so exact equality breaks dedup even with
  // the format fixed. +/-10 minutes comfortably absorbs that drift without
  // conflating genuinely different events (the closest ISS passes for one
  // city are ~90 minutes apart).
  const target = new Date(event.starts_at)
  const rangeStart = new Date(target.getTime() - 10 * 60_000).toISOString().replace('T', ' ')
  const rangeEnd = new Date(target.getTime() + 10 * 60_000).toISOString().replace('T', ' ')
  const filter = `kind = "${event.kind}" && target = "${event.target}" && starts_at >= "${rangeStart}" && starts_at <= "${rangeEnd}"`
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
  let failed = 0

  // One plugin's fetch failing (a dead API) or one event failing to upsert
  // (e.g. a `kind` not yet added to the sky_events select field) used to
  // abort the entire run via the uncaught rejection below -- silently
  // skipping every plugin listed after it. Isolating failures per plugin
  // and per event means a single bad source degrades gracefully instead of
  // starving the rest of the ingest.
  for (const { fetch: plugin, windowDays } of PLUGINS) {
    let events
    try {
      events = await plugin(windowDays ? { now, windowDays } : { now })
    } catch (error) {
      console.error(`Plugin ${plugin.name} failed to fetch events:`, error.message)
      failed += 1
      continue
    }
    for (const event of events) {
      try {
        const result = await upsert(pb, event)
        if (result.action === 'created') created += 1
        else updated += 1
      } catch (error) {
        console.error(`Failed to upsert "${event.title}" (${event.kind}/${event.target}):`, error.message)
        failed += 1
      }
    }
  }

  console.log(`Ingest complete: ${created} created, ${updated} updated, ${failed} failed.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

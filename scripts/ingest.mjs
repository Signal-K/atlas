#!/usr/bin/env node
// Backwards-compatible entry point for the former daily ingest job.
// Atlas now ships reviewed, finite catalogue snapshots instead of mirroring
// every live source. See seed-curated-window.mjs for the source policy.
import { seedCuratedWindow, CURATED_WINDOW_DAYS } from './seed-curated-window.mjs'

const result = await seedCuratedWindow({ apply: true })
console.log(JSON.stringify({
  mode: 'applied',
  windowDays: CURATED_WINDOW_DAYS,
  eventCount: result.events.length,
  sourceFailures: result.sourceFailures,
  created: result.created,
  updated: result.updated,
  duplicatesRemoved: result.duplicatesRemoved,
}, null, 2))

if (result.sourceFailures.length) process.exitCode = 1

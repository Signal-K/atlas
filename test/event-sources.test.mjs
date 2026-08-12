import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fetchEvents as fetchEclipseEvents } from '../scripts/sources/eclipses.mjs'
import { fetchEvents as fetchMeteorShowerEvents } from '../scripts/sources/meteor-showers.mjs'
import { isInCuratedWindow } from '../scripts/seed-curated-window.mjs'

const TODAY = new Date('2026-08-12T00:00:00.000Z')

test('Perseids remain in the catalogue throughout their August 12 peak day', async () => {
  const events = await fetchMeteorShowerEvents({ now: TODAY, windowDays: 1 })
  const perseids = events.find((event) => event.target === 'perseids')

  assert.ok(perseids, 'expected the annual Perseids event')
  assert.equal(isInCuratedWindow(perseids, { now: TODAY, windowDays: 1 }), true)
  assert.ok(new Date(perseids.starts_at) < TODAY, 'the watch begins on the previous evening')
  assert.ok(new Date(perseids.ends_at) > TODAY, 'the peak-day window is still active')
})

test('August 12 2026 includes the real total solar eclipse', async () => {
  const events = await fetchEclipseEvents({ now: TODAY, windowDays: 1 })
  const eclipse = events.find((event) => event.target === 'sun' && event.title === 'Total Solar Eclipse')

  assert.ok(eclipse, 'expected the Astronomy Engine total solar eclipse prediction')
  assert.equal(eclipse.starts_at, '2026-08-12T17:45:46.794Z')
  assert.equal(isInCuratedWindow(eclipse, { now: TODAY, windowDays: 1 }), true)
})

test('AI caption hook is authenticated, secret-gated, and uses the configured vision model', async () => {
  const hook = await readFile(new URL('../pocketbase/pb_hooks/photo-caption.pb.js', import.meta.url), 'utf8')

  assert.match(hook, /\$os\.getenv\('ANTHROPIC_API_KEY'\)/)
  assert.match(hook, /\$apis\.requireAuth\(\)/)
  assert.match(hook, /model: 'claude-haiku-4-5-20251001'/)
})

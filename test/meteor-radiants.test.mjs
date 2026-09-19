import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fetchEvents } from '../src/lib/eventSources/meteor-showers.mjs'

const visibility = await readFile(new URL('../src/lib/eventVisibility.mjs', import.meta.url), 'utf8')

// METEOR_RADIANTS is module-private, so read the literal out of the source.
// Only the key set matters here; the coordinates themselves are checked by
// event-visibility.test.mjs against real sky positions.
const radiantBlock = visibility.slice(
  visibility.indexOf('const METEOR_RADIANTS = {'),
  visibility.indexOf('\n}', visibility.indexOf('const METEOR_RADIANTS = {')),
)
assert.notEqual(radiantBlock, '', 'expected to find the METEOR_RADIANTS literal in eventVisibility.mjs')
const radiantKeys = [...radiantBlock.matchAll(/^\s+(\w+):\s*\[/gm)].map(([, key]) => key).sort()

// A window wide enough to include every annual shower: the generator emits one
// event per shower per year it overlaps, so two calendar years of coverage
// guarantees all eight appear regardless of where in the year `now` falls.
const NOW = new Date('2026-01-01T00:00:00.000Z')
const WINDOW_DAYS = 800

// The coupled invariant: a shower whose target has no radiant entry is
// invisible -- visibilityForEvent finds no radiant, so no observer ever sees
// it. Adding a ninth shower to meteor-showers.mjs without adding its radiant
// here would produce an event that exists in the catalogue and can never be
// shown, which is silent rather than broken.
test('every shower the generator emits has a radiant in eventVisibility', async () => {
  const events = await fetchEvents({ now: NOW, windowDays: WINDOW_DAYS })
  const targets = [...new Set(events.map((event) => event.target))].sort()

  assert.equal(targets.length, 8, `expected 8 distinct showers in the window, got ${targets.length}: ${targets.join(', ')}`)
  assert.deepEqual(targets, radiantKeys)
})

test('every radiant names a shower the generator actually emits', async () => {
  const events = await fetchEvents({ now: NOW, windowDays: WINDOW_DAYS })
  const emitted = new Set(events.map((event) => event.target))

  for (const key of radiantKeys) {
    assert.ok(emitted.has(key), `${key} has a radiant but is not emitted by meteor-showers.mjs, so it is dead weight`)
  }
})

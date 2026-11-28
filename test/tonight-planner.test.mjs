import test from 'node:test'
import assert from 'node:assert/strict'
import { goNoGo, howToFor, PLANNER_GEARS } from '../src/lib/tonightPlanner.mjs'
import { SKY_NAVIGATION_TERMS } from '../src/lib/skyNavigationGuide.mjs'

test('go/no-go follows rating and cloud', () => {
  assert.equal(goNoGo('great', 10, 20).verdict, 'go')
  assert.equal(goNoGo('maybe', 55, 20).verdict, 'maybe')
  assert.equal(goNoGo('good', 90, 20).verdict, 'no-go')
  assert.equal(goNoGo('skip', null, null).verdict, 'no-go')
  assert.match(goNoGo('good', 10, 90).reason, /Moon/)
})

test('every gear gets a how-to for every kind', () => {
  for (const gear of PLANNER_GEARS) {
    for (const kind of ['moon_phase', 'planet_event', 'deep_sky', 'meteor_shower', 'iss_pass', 'unknown']) {
      const how = howToFor(kind, gear.id)
      assert.ok(how.text.length > 10 && how.timing)
    }
  }
})

test('sky navigation guide covers the four terms', () => {
  assert.deepEqual(SKY_NAVIGATION_TERMS.map(t => t.term), ['Horizon', 'Zenith', 'Altitude', 'Azimuth'])
})

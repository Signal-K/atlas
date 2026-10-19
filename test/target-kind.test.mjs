import assert from 'node:assert/strict'
import test from 'node:test'

import { kindFromTargetName } from '../src/lib/targetKind.ts'
import { projectProgress } from '../src/lib/progress.ts'

test('target names map to the sighting kind they describe', () => {
  assert.equal(kindFromTargetName('Jupiter'), 'planet_event')
  assert.equal(kindFromTargetName('  saturn at opposition '), 'planet_event')
  assert.equal(kindFromTargetName('Moon–Jupiter conjunction'), 'conjunction')
  assert.equal(kindFromTargetName('Total lunar eclipse'), 'eclipse')
  assert.equal(kindFromTargetName('Full Moon'), 'moon_phase')
  assert.equal(kindFromTargetName('ISS pass'), 'iss_pass')
  assert.equal(kindFromTargetName('Perseids'), 'meteor_shower')
  assert.equal(kindFromTargetName('Andromeda Galaxy'), 'deep_sky')
  assert.equal(kindFromTargetName('M31'), 'deep_sky')
})

test('unrecognised or empty targets earn no typed bonus', () => {
  assert.equal(kindFromTargetName('Something faint'), undefined)
  assert.equal(kindFromTargetName(''), undefined)
  assert.equal(kindFromTargetName(undefined), undefined)
})

test('a fallback kind feeds the typed Observing split', () => {
  const summary = projectProgress({
    observations: [{ id: 'a', userId: 'u', observedAt: '2026-10-01T20:00:00.000Z', targetName: 'Jupiter' }],
    sightingKinds: { a: kindFromTargetName('Jupiter') },
  })
  assert.equal(summary.skills.observing, 15)
  assert.deepEqual(summary.observingByKind, { planet_event: 5 })
})

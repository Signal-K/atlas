import assert from 'node:assert/strict'
import test from 'node:test'
import { findObjectEventResults } from '../src/lib/objectEventSearch.mjs'

const objects = [
  { id: 'm42', name: 'Orion Nebula', kind: 'nebula' },
  { id: 'neptune', name: 'Neptune', kind: 'planet' },
]

const events = [
  { id: 'later-m42', target: 'm42', title: 'Orion Nebula', startsAt: '2026-10-02T21:00:00Z', endsAt: '2026-10-03T00:00:00Z' },
  { id: 'next-m42', target: 'm42', title: 'Orion Nebula', startsAt: '2026-10-01T21:00:00Z', endsAt: '2026-10-02T00:00:00Z' },
  { id: 'neptune-opposition', target: 'neptune', title: 'Neptune at opposition', startsAt: '2026-09-26T20:00:00Z', endsAt: '2026-09-27T04:00:00Z' },
  { id: 'past-m42', target: 'm42', title: 'Orion Nebula', startsAt: '2026-09-01T21:00:00Z', endsAt: '2026-09-02T00:00:00Z' },
]

test('finds an object by catalogue identifier and orders its next events', () => {
  const [result] = findObjectEventResults(objects, events, 'M42', { nowMs: Date.parse('2026-09-24T00:00:00Z') })
  assert.equal(result.name, 'Orion Nebula')
  assert.deepEqual(result.events.map((event) => event.id), ['next-m42', 'later-m42'])
})
test('finds a planet and excludes events that have already ended', () => {
  const [result] = findObjectEventResults(objects, events, 'nept', { nowMs: Date.parse('2026-09-24T00:00:00Z') })
  assert.equal(result.name, 'Neptune')
  assert.deepEqual(result.events.map((event) => event.id), ['neptune-opposition'])
})

test('does not flood the overlay before the user searches', () => {
  assert.deepEqual(findObjectEventResults(objects, events, '  '), [])
})

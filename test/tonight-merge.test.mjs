import assert from 'node:assert/strict'
import test from 'node:test'
import { combineTonightTargets } from '../src/lib/tonightMerge.mjs'

const calendar = [{ eventId: 'orionids', title: 'Orionids' }]
const observing = [
  { eventId: 'orionids', title: 'Orionids' },
  { eventId: 'arcturus', title: 'Arcturus' },
  { eventId: 'spica', title: 'Spica' },
]

test('a maybe night includes the stars search already lists', () => {
  const combined = combineTonightTargets(calendar, observing, 'maybe')
  assert.deepEqual(combined.map((target) => target.eventId), ['orionids', 'arcturus', 'spica'])
})

test('a cloudy skip night still counts the stars that are up', () => {
  const combined = combineTonightTargets([], observing, 'skip')
  assert.deepEqual(
    combined.map((target) => target.eventId),
    ['orionids', 'arcturus', 'spica'],
  )
})

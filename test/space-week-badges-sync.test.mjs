import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { evaluateSpaceWeekBadges } from '../src/lib/spaceWeekBadges.mjs'
import { SATURN_TASKS } from '../src/lib/telescopeSaturnTasks.mjs'

// ASV-127/128 sync contract. Space Week badges have no storage of their own:
// they are a pure function of check-ins, which sync to atlas_observations. So
// the badges reach a second device exactly when every field the evaluator
// reads survives the push and pull mappings in sync.ts. This pins that.
const sync = readFileSync(new URL('../src/lib/sync.ts', import.meta.url), 'utf8')

const FIELDS = [
  ['observedAt', 'observed_at'],
  ['eventId', 'event'],
  ['note', 'note'],
  ['targetName', 'target_name'],
  ['checkInKind', 'check_in_kind'],
]

for (const [local, remote] of FIELDS) {
  test(`check-in field ${local} is pushed to and pulled from ${remote}`, () => {
    assert.match(sync, new RegExp(`\\b${remote}: `), `push must send ${remote}`)
    assert.match(sync, new RegExp(`record\\.${remote}\\b`), `pull must read ${remote}`)
  })
}

test('a pulled check-in earns the same badges as the device that logged it', () => {
  const logged = [{ id: 'a', userId: 'u', observedAt: '2026-10-07T19:00:00.000Z', targetName: 'Saturn', checkInKind: 'tonight' }]
  // What a second device holds after pull: new local id, same synced fields.
  const pulled = logged.map((row) => ({ ...row, id: 'other-device-id', remoteId: 'pb1' }))
  const tiers = (rows) => evaluateSpaceWeekBadges(rows).map((badge) => [badge.id, badge.tier])
  assert.deepEqual(tiers(pulled), tiers(logged))
  assert.equal(tiers(logged).find(([id]) => id === 'space-week-saturn')[1], 'gold')
})

test('Saturn task badges are period-derived labels with no completion state to sync', () => {
  for (const task of SATURN_TASKS) {
    assert.deepEqual(Object.keys(task).sort(), ['detail', 'id', 'links', 'listed', 'period', 'title'], task.id)
  }
})

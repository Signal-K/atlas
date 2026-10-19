import assert from 'node:assert/strict'
import test from 'node:test'

import { SPACE_WEEK_BADGES, evaluateSpaceWeekBadges, spaceWeekBadgeLink } from '../src/lib/spaceWeekBadges.mjs'

const obs = (id, observedAt, extra = {}) => ({ id, userId: 'u', observedAt, ...extra })
const tierOf = (list, id) => list.find((b) => b.id === id).tier

test('all five Space Week badges exist, unearned with no check-ins', () => {
  const state = evaluateSpaceWeekBadges([])
  assert.deepEqual(state.map((b) => b.id), SPACE_WEEK_BADGES.map((b) => b.id))
  assert.equal(state.length, 5)
  assert.ok(state.every((b) => b.tier === null))
})

test('gold on the event date, silver any time after, nothing before', () => {
  assert.equal(tierOf(evaluateSpaceWeekBadges([obs('a', '2026-10-07T19:00:00.000Z', { targetName: 'Saturn' })]), 'space-week-saturn'), 'gold')
  assert.equal(tierOf(evaluateSpaceWeekBadges([obs('a', '2026-10-15T19:00:00.000Z', { targetName: 'Saturn' })]), 'space-week-saturn'), 'silver')
  assert.equal(tierOf(evaluateSpaceWeekBadges([obs('a', '2026-10-06T19:00:00.000Z', { targetName: 'Saturn' })]), 'space-week-saturn'), null)
})

test('event night logged afterwards as a past check-in is silver; gold wins when both exist', () => {
  const past = obs('p', '2026-10-08T20:00:00.000Z', { targetName: 'Draconids', checkInKind: 'past' })
  assert.equal(tierOf(evaluateSpaceWeekBadges([past]), 'space-week-draconids'), 'silver')
  const live = obs('l', '2026-10-08T20:00:00.000Z', { targetName: 'Draconid meteors', checkInKind: 'tonight' })
  assert.equal(tierOf(evaluateSpaceWeekBadges([past, live]), 'space-week-draconids'), 'gold')
})

test('M31 and New Moon dark-sky match by target; unreviewed claims do not count', () => {
  const state = evaluateSpaceWeekBadges([
    obs('m', '2026-10-10T21:00:00.000Z', { targetName: 'M31 Andromeda' }),
    obs('n', '2026-10-10T22:00:00.000Z', { targetName: 'New Moon dark sky', reviewStatus: 'pending' }),
  ])
  assert.equal(tierOf(state, 'space-week-m31'), 'gold')
  assert.equal(tierOf(state, 'space-week-new-moon'), null)
})

test('Space Week stamp takes any check-in but not a community night; links deep-link to the badge', () => {
  assert.equal(tierOf(evaluateSpaceWeekBadges([obs('c', '2026-10-07T20:00:00.000Z', { communityNightHost: 'X' })]), 'space-week-stamp'), null)
  assert.equal(tierOf(evaluateSpaceWeekBadges([obs('c', '2026-10-07T20:00:00.000Z')]), 'space-week-stamp'), 'gold')
  assert.equal(spaceWeekBadgeLink('space-week-m31'), '/app/profile?badge=space-week-m31')
})

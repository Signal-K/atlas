import assert from 'node:assert/strict'
import test from 'node:test'

import { describeAward, projectProgress } from '../src/lib/progress.ts'

function observation(id, observedAt, extra = {}) {
  return { id, userId: 'user-1', observedAt, ...extra }
}

test('pending review earns no points or first-check-in milestone', () => {
  const progress = projectProgress({
    observations: [observation('pending', '2026-10-01T20:30:00.000Z', { reviewStatus: 'pending', photoR2Key: 'private.jpg' })],
  })

  assert.equal(progress.totalPoints, 0)
  assert.equal(progress.milestones.find((milestone) => milestone.id === 'first-check-in')?.achieved, false)
})

test('two qualifying check-ins on one civil date count as one night out', () => {
  const progress = projectProgress({
    observations: [
      observation('first', '2026-10-01T19:30:00.000Z'),
      observation('second', '2026-10-01T22:30:00.000Z', { reviewStatus: 'approved' }),
    ],
  })

  assert.equal(progress.skills.observing, 10)
  assert.equal(progress.totalPoints, 10)
})

test('a private attached photo is not a published photo', () => {
  const privateProgress = projectProgress({
    observations: [observation('private', '2026-10-01T19:30:00.000Z', { photoR2Key: 'private.jpg' })],
  })
  const publishedProgress = projectProgress({
    observations: [observation('published', '2026-10-02T19:30:00.000Z', { photoR2Key: 'published.jpg', isPublic: true })],
  })

  assert.equal(privateProgress.skills.photography, 8)
  assert.equal(privateProgress.milestones.find((milestone) => milestone.id === 'first-photo-published')?.achieved, false)
  assert.equal(publishedProgress.skills.photography, 23)
  assert.equal(publishedProgress.milestones.find((milestone) => milestone.id === 'first-photo-published')?.achieved, true)
})

test('a qualifying backdated night earns points without touching a streak', () => {
  const progress = projectProgress({
    observations: [observation('past', '2024-01-08T21:00:00.000Z', { reviewStatus: 'approved', checkInKind: 'past' })],
  })

  assert.equal(progress.totalPoints, 10)
  assert.equal('streak' in progress, false)
})

test('projects a synced trip and First light badge onto the level curve', () => {
  const progress = projectProgress({
    observations: [],
    firstTourBadge: 'first_light',
    tripPlan: {
      id: 'remote-plan', startDate: '2026-10-10', endDate: '2026-10-14', equipment: [], interests: [], guides: {},
      legs: [
        { id: 'one', cityKey: 'tallinn', cityName: 'Tallinn', lat: 59.4, lon: 24.7, startDate: '2026-10-10', endDate: '2026-10-11' },
        { id: 'two', cityKey: 'helsinki', cityName: 'Helsinki', lat: 60.1, lon: 24.9, startDate: '2026-10-12', endDate: '2026-10-14' },
      ],
    },
  })

  assert.equal(progress.skills.planning, 40)
  assert.equal(progress.level, 2)
  assert.equal(progress.nextLevelAt, 100)
})

test('award copy reports the points a save added and the next milestone', () => {
  const before = projectProgress({ observations: [] })
  const after = projectProgress({ observations: [observation('a', '2026-10-01T19:30:00.000Z')] })

  assert.equal(describeAward(before, after), 'Session logged · +10 pts. Next: First photo published.')
})

test('a second check-in the same night reports no new points', () => {
  const first = observation('a', '2026-10-01T19:30:00.000Z')
  const before = projectProgress({ observations: [first] })
  const after = projectProgress({ observations: [first, observation('b', '2026-10-01T22:00:00.000Z')] })

  assert.match(describeAward(before, after), /already counted/)
})

test('a pending past check-in says it counts once approved with 0 points', () => {
  const pending = observation('p', '2026-09-01T12:00:00.000Z', { reviewStatus: 'unsent' })
  const before = projectProgress({ observations: [] })
  const after = projectProgress({ observations: [pending] })

  assert.equal(after.totalPoints - before.totalPoints, 0)
  assert.equal(describeAward(before, after, { pendingReview: true }), 'Sent for review — 0 pts now; the night counts once approved.')
})

test('conjunction, planet and star check-ins each land on their own observing line', () => {
  const observations = [
    observation('c', '2026-10-01T19:00:00.000Z'),
    observation('p', '2026-10-02T19:00:00.000Z'),
    observation('s', '2026-10-03T19:00:00.000Z'),
  ]
  const progress = projectProgress({
    observations,
    sightingKinds: { c: 'conjunction', p: 'planet_event', s: 'bright_star' },
  })

  assert.deepEqual(progress.observingByKind, { conjunction: 5, planet_event: 5, bright_star: 5 })
  assert.equal(progress.skills.observing, 3 * 10 + 3 * 5)
})

test('a night_sky_guide check-in adds no typed bonus', () => {
  const progress = projectProgress({
    observations: [observation('g', '2026-10-01T19:00:00.000Z'), observation('l', '2026-10-02T19:00:00.000Z'), observation('k', '2026-10-03T19:00:00.000Z')],
    sightingKinds: { g: 'night_sky_guide', l: 'local_night_sky', k: 'comet' },
  })

  assert.deepEqual(progress.observingByKind, {})
  assert.equal(progress.skills.observing, 30)
})

test('a pending typed check-in earns no typed bonus', () => {
  const progress = projectProgress({
    observations: [observation('p', '2026-10-01T19:00:00.000Z', { reviewStatus: 'pending' })],
    sightingKinds: { p: 'conjunction' },
  })

  assert.equal(progress.totalPoints, 0)
})

test('opening recipe R for target T then logging T with R earns the advice bonus exactly once', () => {
  const entry = observation('a', '2026-10-01T21:00:00.000Z', { targetName: 'Jupiter', cameraRecipeUsed: 'bright_planet' })
  const opens = [{ recipeKey: 'bright_planet', target: 'jupiter', openedAt: '2026-10-01T18:00:00.000Z' }]
  const without = projectProgress({ observations: [entry] })
  const withAdvice = projectProgress({ observations: [entry], recipeOpens: opens })
  // Duplicate opens of the same pair must not stack.
  const duplicated = projectProgress({ observations: [entry], recipeOpens: [...opens, ...opens] })

  assert.equal(withAdvice.skills.photography - without.skills.photography, 12)
  assert.equal(duplicated.skills.photography, withAdvice.skills.photography)
})

test('a log without camera_recipe_used, or opened after the attempt, gets no advice bonus', () => {
  const opens = [{ recipeKey: 'bright_planet', target: 'Jupiter', openedAt: '2026-10-01T18:00:00.000Z' }]
  const blank = observation('b', '2026-10-01T21:00:00.000Z', { targetName: 'Jupiter' })
  const early = observation('c', '2026-10-01T17:00:00.000Z', { targetName: 'Jupiter', cameraRecipeUsed: 'bright_planet' })
  const mismatch = observation('d', '2026-10-01T21:00:00.000Z', { targetName: 'Saturn', cameraRecipeUsed: 'bright_planet' })

  for (const entry of [blank, early, mismatch]) {
    assert.equal(projectProgress({ observations: [entry], recipeOpens: opens }).skills.photography, 0)
  }
})

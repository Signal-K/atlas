import assert from 'node:assert/strict'
import test from 'node:test'

import { projectProgress } from '../src/lib/progress.ts'

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

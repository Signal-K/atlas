import assert from 'node:assert/strict'
import test from 'node:test'

import { buildTrainingPath, evaluateTrainingPath, nextPathStep } from '../src/lib/trainingPath.ts'

const base = { experienceLevel: 'beginner', interestKinds: [], purposeChips: [] }

function observation(id, extra = {}) {
  return { id, userId: 'u', observedAt: '2026-10-01T20:00:00.000Z', ...extra }
}

test('a path always has three distinct steps', () => {
  const steps = buildTrainingPath(base)
  assert.equal(steps.length, 3)
  assert.equal(new Set(steps.map((step) => step.id)).size, 3)
})

test('changing interests regenerates the category step', () => {
  const planets = buildTrainingPath({ ...base, interestKinds: ['planet_event', 'conjunction'] })
  const meteors = buildTrainingPath({ ...base, interestKinds: ['meteor_shower', 'fireball'] })

  assert.equal(planets[1].criterion.categoryId, 'planets')
  assert.equal(meteors[1].criterion.categoryId, 'meteor-showers')
  assert.notEqual(planets[1].title, meteors[1].title)
})

test('survey chips choose the third step', () => {
  assert.equal(buildTrainingPath({ ...base, purposeChips: ['Planning sessions with my telescope'] })[2].criterion.type, 'trip')
  assert.equal(buildTrainingPath({ ...base, purposeChips: ['Learning the sky as a beginner'] })[2].criterion.type, 'tour')
})

test('experienced observers get a different first step than beginners', () => {
  assert.notEqual(buildTrainingPath(base)[0].id, buildTrainingPath({ ...base, experienceLevel: 'expert' })[0].id)
})

test('a matching check-in marks that step done and moves the next step on', () => {
  const templates = buildTrainingPath({ ...base, interestKinds: ['conjunction'], purposeChips: ['Photographing the sky'] })
  const before = evaluateTrainingPath(templates, { observations: [] })
  assert.equal(nextPathStep(before)?.criterion.type, 'check-in')

  const after = evaluateTrainingPath(templates, {
    observations: [observation('c')],
    sightingKinds: { c: 'conjunction' },
  })
  assert.deepEqual(after.map((step) => step.done), [true, true, false])
  assert.equal(nextPathStep(after)?.criterion.type, 'photo')
})

test('a guide check-in or pending entry does not complete the category step', () => {
  const templates = buildTrainingPath({ ...base, interestKinds: ['conjunction'] })
  const guide = evaluateTrainingPath(templates, { observations: [observation('g')], sightingKinds: { g: 'night_sky_guide' } })
  const pending = evaluateTrainingPath(templates, { observations: [observation('p', { reviewStatus: 'pending' })], sightingKinds: { p: 'conjunction' } })

  assert.equal(guide[1].done, false)
  assert.equal(pending[0].done, false)
  assert.equal(pending[1].done, false)
})

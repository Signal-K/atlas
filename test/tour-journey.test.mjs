import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FIRST_TOUR_BADGE,
  FIRST_TOUR_ID,
  createTourCompletion,
  pickNextTourTarget,
  tourAnalyticsProperties,
} from '../src/lib/tourJourney.mjs'

test('locks the tour funnel property contract', () => {
  assert.deepEqual(tourAnalyticsProperties({ locationPresent: true, authenticated: false }), {
    tour_id: FIRST_TOUR_ID,
    location_present: true,
    account_state: 'guest',
    incentive_eligible: true,
  })
})

test('creates the persistent first-light unlock', () => {
  assert.deepEqual(createTourCompletion({ completedAt: '2026-09-24T00:00:00Z', targetId: 'm42', targetTitle: 'Orion Nebula' }), {
    tourId: FIRST_TOUR_ID,
    badge: FIRST_TOUR_BADGE,
    completedAt: '2026-09-24T00:00:00Z',
    targetId: 'm42',
    targetTitle: 'Orion Nebula',
  })
})

test('next-tour selection does not repeat the completed target', () => {
  const targets = [{ eventId: 'm42' }, { eventId: 'saturn' }]
  assert.equal(pickNextTourTarget(targets, 'm42')?.eventId, 'saturn')
  assert.equal(pickNextTourTarget([{ eventId: 'm42' }], 'm42'), null)
})

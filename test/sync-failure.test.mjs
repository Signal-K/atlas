import assert from 'node:assert/strict'
import test from 'node:test'
import { describeSyncFailure } from '../src/lib/syncFailure.mjs'

test('offline failures are labelled offline regardless of the error text', () => {
  const out = describeSyncFailure({ stage: 'pull_sky_events', error: 'TypeError: Failed to fetch' }, false)
  assert.equal(out.reason, 'offline')
  assert.equal(out.online, false)
  assert.equal(out.attempt, 1)
})

test('an HTTP status in the error becomes a status and a status class', () => {
  const out = describeSyncFailure({ stage: 'push_observation', error: 'ClientResponseError 503: upstream' }, true)
  assert.equal(out.status, 503)
  assert.equal(out.reason, '5xx')
})

test('network and timeout errors get stable reasons', () => {
  assert.equal(describeSyncFailure({ error: 'TypeError: Load failed' }, true).reason, 'network')
  assert.equal(describeSyncFailure({ error: 'AbortError: The operation was aborted' }, true).reason, 'timeout')
})

test('unknown errors fall back to the error name, then unknown', () => {
  assert.equal(describeSyncFailure({ error: 'RangeError: bad' }, true).reason, 'RangeError')
  assert.equal(describeSyncFailure({ stage: 'x' }, true).reason, 'unknown')
})

test('caller-supplied reason and attempt win, and the original error field is untouched', () => {
  const out = describeSyncFailure({ stage: 'r2_photo_reupload_retry', error: 'boom', reason: 'r2_upload', attempt: 2 }, true)
  assert.equal(out.reason, 'r2_upload')
  assert.equal(out.attempt, 2)
  assert.equal(out.error, 'boom')
})

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  RECONCILE_BASE_MS,
  RECONCILE_MAX_MS,
  cooldownMs,
  reconcileAllowed,
  recordReconcileFailure,
  recordReconcileSuccess,
} from '../src/lib/reconcileBackoff.mjs'

function memoryStorage() {
  const map = new Map()
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k) }
}

test('cooldown doubles per consecutive failure and is capped', () => {
  assert.equal(cooldownMs(0), 0)
  assert.equal(cooldownMs(1), RECONCILE_BASE_MS)
  assert.equal(cooldownMs(2), RECONCILE_BASE_MS * 2)
  assert.equal(cooldownMs(3), RECONCILE_BASE_MS * 4)
  assert.equal(cooldownMs(40), RECONCILE_MAX_MS)
})

test('a failure survives a "reload" (same storage) and blocks until the cooldown ends', () => {
  const storage = memoryStorage()
  assert.equal(reconcileAllowed(storage, 'u1', 1_000), true)
  recordReconcileFailure(storage, 'u1', 1_000)
  assert.equal(reconcileAllowed(storage, 'u1', 1_000 + RECONCILE_BASE_MS - 1), false)
  assert.equal(reconcileAllowed(storage, 'u1', 1_000 + RECONCILE_BASE_MS), true)
})

test('repeated failures back off further, and success resets', () => {
  const storage = memoryStorage()
  let now = 0
  for (let i = 1; i <= 3; i += 1) {
    const state = recordReconcileFailure(storage, 'u1', now)
    assert.equal(state.retryAfter - now, cooldownMs(i))
    now = state.retryAfter
  }
  recordReconcileSuccess(storage)
  assert.equal(reconcileAllowed(storage, 'u1', 0), true)
  assert.equal(recordReconcileFailure(storage, 'u1', 0).failures, 1)
})

test('another account does not inherit a previous account\'s backoff', () => {
  const storage = memoryStorage()
  recordReconcileFailure(storage, 'u1', 0)
  assert.equal(reconcileAllowed(storage, 'u2', 1), true)
})

test('unreadable storage degrades to allowed, never throws', () => {
  const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } }
  assert.equal(reconcileAllowed(broken, 'u1', 0), true)
  assert.doesNotThrow(() => recordReconcileFailure(broken, 'u1', 0))
  assert.doesNotThrow(() => recordReconcileSuccess(broken))
})

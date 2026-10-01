// ASV-113: entitlement reconciliation failures clustered on a couple of
// Mobile Safari users. The old cooldown was a module variable, so every full
// page load (iOS suspends and reloads tabs constantly) reset it and the
// billing call was retried -- and reported -- again straight away, always at
// the same 5-minute step. This keeps the failure count in storage and backs
// off exponentially, so a persistently failing endpoint is tried less often.

export const RECONCILE_BASE_MS = 5 * 60_000
export const RECONCILE_MAX_MS = 60 * 60_000
const KEY = 'atlas-entitlement-reconcile'

export function cooldownMs(consecutiveFailures) {
  if (consecutiveFailures <= 0) return 0
  return Math.min(RECONCILE_MAX_MS, RECONCILE_BASE_MS * 2 ** (consecutiveFailures - 1))
}

function read(storage, userId) {
  try {
    const parsed = JSON.parse(storage.getItem(KEY) ?? 'null')
    if (parsed && parsed.userId === userId && Number.isFinite(parsed.failures) && Number.isFinite(parsed.retryAfter)) return parsed
  } catch {
    // Unreadable or blocked storage behaves like "no failures recorded".
  }
  return { userId, failures: 0, retryAfter: 0 }
}

export function reconcileAllowed(storage, userId, now) {
  return now >= read(storage, userId).retryAfter
}

export function recordReconcileFailure(storage, userId, now) {
  const failures = read(storage, userId).failures + 1
  const state = { userId, failures, retryAfter: now + cooldownMs(failures) }
  try {
    storage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Best effort: without storage this degrades to no backoff, as before.
  }
  return state
}

export function recordReconcileSuccess(storage) {
  try {
    storage.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
}

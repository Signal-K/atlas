export const RECONCILE_BASE_MS: number
export const RECONCILE_MAX_MS: number
export function cooldownMs(consecutiveFailures: number): number
export function reconcileAllowed(storage: Pick<Storage, 'getItem'>, userId: string, now: number): boolean
export function recordReconcileFailure(storage: Pick<Storage, 'getItem' | 'setItem'>, userId: string, now: number): { userId: string; failures: number; retryAfter: number }
export function recordReconcileSuccess(storage: Pick<Storage, 'removeItem'>): void

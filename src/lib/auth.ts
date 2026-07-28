import { useEffect, useState } from 'react'
import { ClientResponseError } from 'pocketbase'
import { pb } from './pocketbase'

const entitlementListeners = new Set<() => void>()
let entitlementRefreshCount = 0

function notifyEntitlementListeners() {
  entitlementListeners.forEach((listener) => listener())
}

function subscribeToEntitlementRefresh(listener: () => void): () => void {
  entitlementListeners.add(listener)
  return () => entitlementListeners.delete(listener)
}

export interface AuthUser {
  id: string
  email: string
  entitled: boolean
}

// An expired token (the users collection issues 5-day tokens) is dead: every
// request made with it 401s, and refreshEntitlement() below bails before it
// can reconcile anything. Reporting that state as a *signed-in* user stranded
// paid accounts on the paywall -- the app kept rendering `entitled` from the
// stale cached record, so a browser left unopened for a week showed "signed
// in as you, no Sky Pass found" with no route back except a manual sign-out
// the UI never suggested. Treat an expired session as signed out so the
// paywall offers "Sign in / create account", which restores entitlement.
function currentUser(): AuthUser | null {
  const model = pb.authStore.record
  if (!model || !pb.authStore.isValid) return null
  return { id: model.id as string, email: model.email as string, entitled: Boolean(model.entitled) }
}

// Whether the stored token is still usable. Lets callers tell "the server is
// unreachable" apart from "this session ended", which need different advice.
export function hasValidSession(): boolean {
  return pb.authStore.isValid
}

// Reactive wrapper around pb.authStore so components re-render on
// sign-in/sign-out. The SDK persists the token itself (localStorage), so
// this is just the React-facing view of that state.
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(currentUser())
  const [entitlementRefreshing, setEntitlementRefreshing] = useState(entitlementRefreshCount > 0)

  useEffect(() => {
    // Drop a dead token rather than leaving it in localStorage to be replayed
    // (and 401'd) by every isValid-guarded caller for the rest of the session.
    if (pb.authStore.record && !pb.authStore.isValid) pb.authStore.clear()
    const unsubscribeAuth = pb.authStore.onChange(() => {
      setUser(currentUser())
    })
    const unsubscribeEntitlement = subscribeToEntitlementRefresh(() => setEntitlementRefreshing(entitlementRefreshCount > 0))
    return () => {
      unsubscribeAuth()
      unsubscribeEntitlement()
    }
  }, [])

  return { user, entitlementRefreshing }
}

export async function signIn(email: string, password: string): Promise<void> {
  await pb.collection('users').authWithPassword(email, password)
}

function isExistingAccountError(error: unknown): boolean {
  if (!(error instanceof ClientResponseError)) return false
  const fieldErrors = Object.entries(error.response?.data ?? {}) as Array<[string, { code?: string; message?: string }]>
  return fieldErrors.some(([field, details]) => {
    if (field !== 'email') return false
    const code = details?.code?.toLowerCase() ?? ''
    const message = details?.message?.toLowerCase() ?? ''
    return code.includes('unique') || message.includes('already') || message.includes('in use')
  })
}

export async function signUp(email: string, password: string): Promise<void> {
  try {
    await pb.collection('users').create({ email, password, passwordConfirm: password })
  } catch (error) {
    if (!isExistingAccountError(error)) throw error
  }
  await pb.collection('users').authWithPassword(email, password)
}

export function signOut(): void {
  pb.authStore.clear()
}

// Re-fetches the signed-in user's record (e.g. `entitled`, flipped
// server-side by the Polar webhook after a purchase) since the cached
// authStore snapshot only otherwise updates on the next sign-in.
export async function refreshEntitlement(): Promise<AuthUser | null> {
  if (!pb.authStore.isValid) return null
  entitlementRefreshCount += 1
  notifyEntitlementListeners()
  try {
    let reconciledAsEntitled = false
    try {
      // Webhooks are the fast path, but reconciliation makes paid access
      // self-healing if Polar's asynchronous delivery was missed or delayed.
      const result = await pb.send<{ entitled?: boolean }>('/entitlement/polar/refresh', { method: 'POST' })
      reconciledAsEntitled = result.entitled === true
    } catch {
      // Best-effort. authRefresh below still picks up a webhook-applied change.
    }
    try {
      await pb.collection('users').authRefresh()
    } catch {
      // Best-effort -- e.g. offline or PocketBase unreachable; the cached
      // snapshot stays as-is until the next successful refresh.
    }
    // The reconciliation endpoint is authoritative. Some older PocketBase
    // auth responses omit a newly-added custom field and would otherwise
    // overwrite a confirmed paid result with the cached `false` value. Apply
    // the server result to the auth store after authRefresh so React updates
    // immediately and the paid account cannot be re-paywalled.
    if (reconciledAsEntitled && pb.authStore.record) {
      pb.authStore.save(pb.authStore.token, { ...pb.authStore.record, entitled: true })
    }
    return currentUser()
  } finally {
    entitlementRefreshCount = Math.max(0, entitlementRefreshCount - 1)
    notifyEntitlementListeners()
  }
}

// Polar can redirect back a fraction before its order.paid webhook has
// finished. Refresh a few times in the background so a successful purchase
// unlocks without requiring a manual reload or a trip through Settings.
export async function refreshEntitlementAfterCheckout(): Promise<void> {
  const delays = [0, 750, 2_000, 4_000]
  for (const delay of delays) {
    if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay))
    const user = await refreshEntitlement()
    if (!user || user.entitled) return
  }
}

// Surfaces PocketBase's actual per-field validation message (e.g. "email
// already exists", the real password rule) instead of a fixed guess --
// sign-in/sign-up were previously showing the same hardcoded string for
// every failure, which misled users when the real cause was unrelated
// (e.g. this account already existing) to the message shown.
export function authErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ClientResponseError) {
    const fieldErrors = Object.values(error.response?.data ?? {}) as Array<{ message?: string }>
    const firstFieldMessage = fieldErrors.find((field) => field?.message)?.message
    return firstFieldMessage ?? error.response?.message ?? fallback
  }
  return fallback
}

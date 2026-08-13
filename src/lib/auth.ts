import { useEffect, useState } from 'react'
import { ClientResponseError } from 'pocketbase'
import { pb } from './pocketbase'

const entitlementListeners = new Set<() => void>()
let entitlementRefreshCount = 0
let entitlementRefreshPromise: Promise<AuthUser | null> | null = null

// Dev-only local preview: lets a local session skip real sign-in and flip
// Sky Pass on/off to visually check both paywall states, without creating
// an account or touching pb.authStore. `import.meta.env.DEV` is replaced
// with a literal `false` in production builds, so this whole branch (and
// the DevPreviewPanel that drives it) is dead-code-eliminated -- it cannot
// reach a real build.
const DEV = import.meta.env.DEV
let devPreviewUser: AuthUser | null = null
const devPreviewListeners = new Set<() => void>()

export function getDevPreviewUser(): AuthUser | null {
  return DEV ? devPreviewUser : null
}

export function setDevPreviewUser(user: AuthUser | null): void {
  if (!DEV) return
  devPreviewUser = user
  devPreviewListeners.forEach((listener) => listener())
}

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
  onboarded: boolean
  deviceModels: string[]
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
  if (DEV && devPreviewUser) return devPreviewUser
  const model = pb.authStore.record
  if (!model || !pb.authStore.isValid) return null
  return {
    id: model.id as string,
    email: model.email as string,
    entitled: Boolean(model.entitled),
    onboarded: Boolean(model.onboarded),
    deviceModels: Array.isArray(model.device_models) ? (model.device_models as string[]) : [],
  }
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
    let unsubscribeDevPreview = () => {}
    if (DEV) {
      const onDevPreviewChange = () => setUser(currentUser())
      devPreviewListeners.add(onDevPreviewChange)
      unsubscribeDevPreview = () => devPreviewListeners.delete(onDevPreviewChange)
    }
    return () => {
      unsubscribeAuth()
      unsubscribeEntitlement()
      unsubscribeDevPreview()
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

// Returns whether this actually created a new account, vs. falling back to
// signing in to one that already existed for this email (shared across the
// product family) -- the caller uses this to show "Welcome back" instead of
// "Account created" when someone hits "Create account" for an identity that
// was already registered.
export async function signUp(email: string, password: string): Promise<{ created: boolean }> {
  try {
    await pb.collection('users').create({ email, password, passwordConfirm: password })
  } catch (error) {
    if (!isExistingAccountError(error)) throw error
    await pb.collection('users').authWithPassword(email, password)
    return { created: false }
  }
  await pb.collection('users').authWithPassword(email, password)
  return { created: true }
}

export function signOut(): void {
  pb.authStore.clear()
}

export async function requestPasswordReset(email: string): Promise<void> {
  await pb.collection('users').requestPasswordReset(email)
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  const id = pb.authStore.record?.id as string | undefined
  if (!id) throw new Error('Not signed in')
  await pb.collection('users').update(id, {
    oldPassword,
    password: newPassword,
    passwordConfirm: newPassword,
  })
}

// PocketBase never applies the new address directly -- it emails a
// confirmation link to newEmail and the change only takes effect once that
// link is opened, so a typo or someone else's address can't lock the real
// owner out.
export async function requestEmailChange(newEmail: string): Promise<void> {
  await pb.collection('users').requestEmailChange(newEmail)
}

// Persists the user's selected phone model(s) (Settings' Device & camera
// setup section) and updates the cached auth record so the UI reflects the
// change without a full re-fetch.
export async function updateDeviceModels(deviceModels: string[]): Promise<void> {
  const id = pb.authStore.record?.id as string | undefined
  if (!id) throw new Error('Not signed in')
  await pb.collection('users').update(id, { device_models: deviceModels })
  if (pb.authStore.record) {
    pb.authStore.save(pb.authStore.token, { ...pb.authStore.record, device_models: deviceModels })
  }
}

// Permanent. Whatever the users collection's delete API rule allows is what
// happens here -- this only calls it and clears the local session on
// success; it doesn't grant any permission the backend didn't already have.
export async function deleteAccount(): Promise<void> {
  const id = pb.authStore.record?.id as string | undefined
  if (!id) throw new Error('Not signed in')
  await pb.collection('users').delete(id)
  pb.authStore.clear()
}

// Re-fetches the signed-in user's record (e.g. `entitled`, flipped
// server-side by the Polar webhook after a purchase) since the cached
// authStore snapshot only otherwise updates on the next sign-in.
export function refreshEntitlement(): Promise<AuthUser | null> {
  if (!pb.authStore.isValid) return Promise.resolve(null)
  // App boot, Settings, focus and the post-checkout return can all request a
  // reconciliation at the same time. Safari in particular is prone to
  // suspending/reordering those duplicate requests. One shared in-flight
  // request means the auth store gets one authoritative result, rather than
  // a late stale auth-refresh racing a successful Polar reconciliation.
  if (entitlementRefreshPromise) return entitlementRefreshPromise
  entitlementRefreshCount += 1
  notifyEntitlementListeners()
  const refresh = (async (): Promise<AuthUser | null> => {
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
  })()
  entitlementRefreshPromise = refresh.finally(() => {
    entitlementRefreshCount = Math.max(0, entitlementRefreshCount - 1)
    entitlementRefreshPromise = null
    notifyEntitlementListeners()
  })
  return entitlementRefreshPromise
}

// Polar can redirect back a fraction before its order.paid webhook has
// finished. Refresh a few times in the background so a successful purchase
// unlocks without requiring a manual reload or a trip through Settings.
export async function refreshEntitlementAfterCheckout(): Promise<void> {
  // A direct Polar reconciliation normally grants the pass on attempt zero.
  // Keep checking for about 40 seconds as a fallback for a slow webhook or a
  // temporarily unavailable Polar API; this runs in the background, while
  // the UI stays explicit that access is still being checked.
  const delays = [0, 1_000, 2_000, 4_000, 8_000, 16_000]
  for (const delay of delays) {
    if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay))
    const user = await refreshEntitlement()
    if (!user || user.entitled) return
  }
}

// Persists onboarding completion on the account itself, not just this
// browser's localStorage -- otherwise a signed-in user on a new device or
// with storage cleared gets sent through onboarding again despite the app
// clearly knowing who they are. Best-effort: if this fails (offline, etc.)
// the local flag OnboardingFlow also sets still prevents a re-prompt on the
// same browser, and the next successful sign-in/refresh retries the sync.
// Named distinctly from OnboardingFlow's own (localStorage-only)
// markOnboardingComplete() -- this one talks to the account.
export async function syncOnboardingToAccount(): Promise<void> {
  const id = pb.authStore.record?.id as string | undefined
  if (!id) return
  try {
    await pb.collection('users').update(id, { onboarded: true })
    if (pb.authStore.record) {
      pb.authStore.save(pb.authStore.token, { ...pb.authStore.record, onboarded: true })
    }
  } catch {
    // Best-effort, see comment above.
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

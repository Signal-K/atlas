import { useEffect, useState } from 'react'
import { ClientResponseError } from 'pocketbase'
import { pb, atlasBillingFetch } from './pocketbase'
import { trackEvent } from './analytics'
import { ONBOARDING_VERSION, clearOnboardingAnswers, getOnboardingAnswers } from './onboarding'

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
  // Which version of the onboarding flow this account last completed; 0 if
  // never. The versioned replacement for `onboarded` as a gate input -- see
  // lib/onboarding.ts. `onboarded` stays as "has ever completed" for
  // reporting, but it cannot express "completed the four-step flow, not the
  // eight-step one", which is exactly the distinction the re-run needs.
  onboardingVersion: number
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
    // `|| 0` rather than a plain Number(): the field is absent from the auth
    // record until migration 39 has run *and* this record has been re-fetched,
    // so Number(undefined) would yield NaN and every comparison against it
    // would be false.
    onboardingVersion: Number(model.onboarding_version) || 0,
    deviceModels: Array.isArray(model.device_models) ? (model.device_models as string[]) : [],
  }
}

// Whether the signed-in account itself has completed the current onboarding
// flow. The gate's handleSignedIn() needs this rather than the `user` prop:
// AuthGate only renders when there is no user, so the handlers close over a
// stale `null` and must read the freshly-populated authStore instead.
export function accountOnboardingVersion(): number {
  const model = pb.authStore.record
  if (!model) return 0
  return Number(model.onboarding_version) || 0
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
    // The initial state above was read at render time; an authStore change
    // between that render and this subscription (e.g. the demo-code redeem's
    // authRefresh landing while a screen mounts) would otherwise be missed
    // and leave a stale `entitled:false` on screen.
    setUser(currentUser())
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

export function signOut(): void {
  pb.authStore.clear()
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
      const result = await atlasBillingFetch<{ entitled?: boolean }>('/entitlement/polar/refresh', { method: 'POST' })
      reconciledAsEntitled = result.entitled === true
    } catch (err) {
      // Best-effort. authRefresh below still picks up a webhook-applied change.
      trackEvent('sync_failed', { stage: 'entitlement_reconcile', error: String(err) })
    }
    try {
      await pb.collection('users').authRefresh()
    } catch (err) {
      // Best-effort -- e.g. offline or PocketBase unreachable; the cached
      // snapshot stays as-is until the next successful refresh.
      trackEvent('sync_failed', { stage: 'auth_refresh', error: String(err) })
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

// Persists onboarding completion -- and the answers the account-side questions
// collected -- on the account itself, not just this browser's localStorage.
// Otherwise a signed-in user on a new device or with storage cleared gets sent
// through onboarding again despite the app clearly knowing who they are, and
// anyone who answered as a guest loses those answers the moment they sign up.
//
// Both writes live in one function deliberately: onboarding_version and the
// answer fields are written to the same record, and two separate hand-merged
// pb.authStore.save() calls racing on the same fields would let the loser drop
// the winner's field from the local cache until the next refresh.
//
// Best-effort: if this fails (offline, etc.) the local flag OnboardingFlow
// also sets still prevents a re-prompt on the same browser, the staged answers
// are left in place for the next attempt, and the next successful sign-in or
// refresh retries. Named distinctly from lib/onboarding.ts's own
// (localStorage-only) markOnboardingComplete() -- this one talks to the account.
export async function syncOnboardingToAccount(): Promise<void> {
  const id = pb.authStore.record?.id as string | undefined
  if (!id) return
  const answers = getOnboardingAnswers()
  const payload: Record<string, unknown> = {
    onboarded: true,
    onboarding_version: ONBOARDING_VERSION,
  }
  // The select fields are omitted rather than sent empty when unanswered:
  // every onboarding question is skippable, and PocketBase rejects an empty
  // value for a select field outright, which would fail the whole update --
  // taking `onboarding_version` down with it and re-running the flow forever.
  if (answers.viewingInstruments.length > 0) payload.viewing_instruments = answers.viewingInstruments
  if (answers.experienceLevel) payload.experience_level = answers.experienceLevel
  payload.in_astro_club = answers.inAstroClub
  payload.astro_club_name = answers.inAstroClub ? answers.astroClubName.slice(0, 120) : ''
  try {
    const saved = await pb.collection('users').update(id, payload)
    // Save the record the server returned, not a hand-built object. PocketBase
    // silently drops unknown fields (it sets only fields the collection knows),
    // so if migration 39 hasn't been applied the update still succeeds and
    // returns a record without our fields -- and a hand-merged cache would then
    // claim a version the server never stored, until the next authRefresh()
    // quietly reverted it and sent the user through onboarding a second time.
    pb.authStore.save(pb.authStore.token, saved)
    // Only clear once the server has actually taken them; a failed push must
    // survive for the next sign-in to retry.
    clearOnboardingAnswers()
  } catch (err) {
    // Best-effort, see comment above.
    trackEvent('sync_failed', { stage: 'onboarding_account_sync', error: String(err) })
  }
}

// Surfaces PocketBase's actual per-field validation message instead of a
// fixed guess. Sign-in/sign-up errors are handled by Clerk's own widgets;
// this is only used for PocketBase-side failures now, e.g. delete-account.
export function authErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ClientResponseError) {
    const fieldErrors = Object.values(error.response?.data ?? {}) as Array<{ message?: string }>
    const firstFieldMessage = fieldErrors.find((field) => field?.message)?.message
    return firstFieldMessage ?? error.response?.message ?? fallback
  }
  return fallback
}

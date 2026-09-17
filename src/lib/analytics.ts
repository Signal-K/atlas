import type { PostHog } from 'posthog-js'
import { pb } from './pocketbase'

// posthog.init's `loaded` callback is typed as PostHogInterface, not the
// PostHog class. Helpers only need identify + startSessionRecording.
type SessionReplayClient = Pick<PostHog, 'identify' | 'startSessionRecording'>

// No-ops when VITE_POSTHOG_KEY isn't set (local dev, CI) so nothing has to
// guard every capture() call with an "is analytics configured" check.
const apiKey = import.meta.env.VITE_POSTHOG_KEY as string | undefined

// posthog-js is ~200KB of the bundle and nothing on first paint needs it, so
// it's loaded as its own chunk after startup rather than imported at the
// entry point. Callers stay synchronous: everything queues onto `loading`,
// which also preserves call ordering (an identify() fired during the load
// still lands before the capture() that follows it).
let loading: Promise<PostHog> | null = null

type AnalyticsUser = { id: string; email: string; entitled: boolean }

// Product surfaces the replay URL trigger is meant to cover. Landing (`/`,
// `/landing`) is deliberately excluded so anonymous marketing traffic is
// not specially started from the client.
export function isProductAnalyticsPath(pathname = defaultPathname()): boolean {
  return pathname === '/app' || pathname.startsWith('/app/') || pathname === '/tonight' || pathname.startsWith('/tonight/')
}

function defaultPathname(): string {
  return typeof window === 'undefined' ? '' : window.location.pathname
}

// Read the persisted PocketBase session directly so identify can run in
// posthog.init's `loaded` callback -- before React mounts, and before the
// first `$pageview`. Importing `currentUser()` from auth.ts would cycle
// (auth already imports this module).
function persistedAnalyticsUser(): AnalyticsUser | null {
  const model = pb.authStore.record
  if (!model || !pb.authStore.isValid) return null
  return {
    id: model.id as string,
    email: model.email as string,
    entitled: Boolean(model.entitled),
  }
}

function applyIdentifiedUser(posthog: SessionReplayClient, user: AnalyticsUser) {
  posthog.identify(user.id, {
    email: user.email,
    atlas_user_id: user.id,
    entitled: user.entitled,
  })
}

// Starts recording only on product routes. Does not pass `true`, so PostHog
// still honours the project's URL/event triggers, minimum duration, and
// sampling. Landing-only sessions are left for those remote controls.
function maybeStartProductSessionRecording(posthog: SessionReplayClient) {
  if (!isProductAnalyticsPath()) return
  posthog.startSessionRecording()
}

export function initAnalytics() {
  if (!apiKey || loading) return
  loading = import('posthog-js').then(({ default: posthog }) => {
    const persistedUser = persistedAnalyticsUser()
    posthog.init(apiKey, {
      // Capture is served first-party through the Atlas domain (see
      // functions/uplink/[[path]].ts) so ad blockers can't drop events by
      // matching PostHog's hostname. The relative default keeps this working on
      // every deploy target -- production, pages.dev, and branch previews --
      // with no extra config, since it resolves against whatever origin serves
      // the app. VITE_POSTHOG_HOST still overrides it (e.g. a dedicated proxy
      // subdomain); an empty value falls back to the built-in proxy.
      api_host: (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || '/uplink',
      // With api_host pointing at the proxy, ui_host names the real PostHog app
      // so the toolbar and in-app links resolve to the right place.
      ui_host: 'https://us.posthog.com',
      // Atlas is a client-side-routed SPA (react-router), so a one-shot
      // pageview on init would miss every subsequent route change --
      // 'history_change' hooks the History API directly instead of
      // requiring a manual $pageview capture() on every navigate() call.
      capture_pageview: 'history_change',
      persistence: 'localStorage',
      // Autocapture unhandled JS errors/promise rejections as PostHog
      // exception events. Atlas has plan generation, camera-recipe imports,
      // location lookups, and paywall/entitlement checks that can all fail
      // silently client-side -- without this, a broken build ships and the
      // only signal is a support message (or nothing at all).
      capture_exceptions: true,
      // Do not set disable_session_recording or a client sampleRate.
      // Ingestion is owned by the PostHog project: URL trigger
      // youratlas.cc/(app|tonight), event triggers (sign-in / plan / recipe /
      // onboarding / device), and a 5s minimum duration. A client sampleRate
      // of 0.2 previously marked most /app sessions `$recording_status:
      // disabled` even when those remote triggers matched.
      //
      // Recording is not disabled at init, so startSessionRecording() below
      // does not override sampling/triggers (never called with `true`).
      session_recording: {
        maskAllInputs: true,
        // Mask the feedback/email fields explicitly since they're the most
        // likely place free-text PII shows up even with inputs masked.
        maskTextSelector: '.feedback-panel textarea, input[type="email"]',
      },
      // Already-signed-in product users should not start as an anonymous
      // distinct_id. Bootstrap + identify-in-loaded attaches email/person
      // onto the recording that URL-triggers on /app or /tonight.
      ...(persistedUser
        ? { bootstrap: { distinctID: persistedUser.id, isIdentifiedID: true } }
        : {}),
      loaded: (loadedPosthog) => {
        if (persistedUser) applyIdentifiedUser(loadedPosthog, persistedUser)
        maybeStartProductSessionRecording(loadedPosthog)
      },
    })
    return posthog
  })
  loading.catch(() => {})
}

// Analytics must never take the app down with it: a blocked or failed chunk
// fetch (offline, ad blocker, bad deploy) leaves this a no-op rather than
// raising an unhandled rejection out of every queued capture() call.
function withPostHog(fn: (posthog: PostHog) => void) {
  if (!loading) return
  void loading.then(fn).catch(() => {})
}

export function trackEvent(name: string, properties?: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent('atlas:analytics-event', { detail: { name, properties } }))
  withPostHog((posthog) => posthog.capture(name, properties))
}

export function identifyAnalyticsUser(user: AnalyticsUser | null) {
  if (!user) return
  withPostHog((posthog) => {
    applyIdentifiedUser(posthog, user)
    maybeStartProductSessionRecording(posthog)
  })
}

// SPA navigations from landing → /app (or a bookmarked /tonight) happen
// after init. Re-check the path so an already-identified user actually
// starts recording once they enter the product, without overriding
// ingestion controls.
export function startProductSessionRecording() {
  withPostHog((posthog) => maybeStartProductSessionRecording(posthog))
}

// Analytics never having loaded (no key, blocked chunk) reads as "flag off"
// rather than an error -- callers can gate UI on this without an extra
// try/catch or "is analytics ready" check of their own.
export function isFeatureEnabled(key: string): Promise<boolean> {
  if (!loading) return Promise.resolve(false)
  return loading.then((posthog) => posthog.isFeatureEnabled(key) ?? false).catch(() => false)
}

export function getFeatureFlag(key: string): Promise<string | boolean | undefined> {
  if (!loading) return Promise.resolve(undefined)
  return loading.then((posthog) => posthog.getFeatureFlag(key)).catch(() => undefined)
}

// Surveys created in PostHog as headless (type: "api") so Atlas keeps
// rendering FeedbackDock's own markup -- this only asks PostHog whether a
// given survey is still active/targeted for the current user, it never
// renders PostHog's own widget.
export function getActiveSurveys(): Promise<Array<{ id: string; name: string }>> {
  if (!loading) return Promise.resolve([])
  return loading
    .then(
      (posthog) =>
        new Promise<Array<{ id: string; name: string }>>((resolve) => {
          posthog.getActiveMatchingSurveys((surveys) => resolve(surveys.map((s) => ({ id: s.id, name: s.name }))), true)
        }),
    )
    .catch(() => [])
}

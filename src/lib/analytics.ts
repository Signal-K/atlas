import type { PostHog } from 'posthog-js'

// No-ops when VITE_POSTHOG_KEY isn't set (local dev, CI) so nothing has to
// guard every capture() call with an "is analytics configured" check.
const apiKey = import.meta.env.VITE_POSTHOG_KEY as string | undefined

// posthog-js is ~200KB of the bundle and nothing on first paint needs it, so
// it's loaded as its own chunk after startup rather than imported at the
// entry point. Callers stay synchronous: everything queues onto `loading`,
// which also preserves call ordering (an identify() fired during the load
// still lands before the capture() that follows it).
let loading: Promise<PostHog> | null = null

export function initAnalytics() {
  if (!apiKey || loading) return
  loading = import('posthog-js').then(({ default: posthog }) => {
    posthog.init(apiKey, {
      api_host: (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com',
      // Atlas is a client-side-routed SPA (react-router), so a one-shot
      // pageview on init would miss every subsequent route change --
      // 'history_change' hooks the History API directly instead of
      // requiring a manual $pageview capture() on every navigate() call.
      capture_pageview: 'history_change',
      persistence: 'localStorage',
      // Session recording's beacon endpoint is blocked in some production
      // browsers/networks and only creates console noise; product analytics
      // events and surveys do not require replay recording.
      disable_session_recording: true,
      // Mask all form input by default (unknown recording audience); the
      // feedback/email fields get an explicit second mask since they're
      // the most likely place free-text PII shows up.
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: '.feedback-panel textarea, input[type="email"]',
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

export function identifyAnalyticsUser(user: { id: string; email: string; entitled: boolean } | null) {
  if (!user) return
  withPostHog((posthog) =>
    posthog.identify(user.id, {
      email: user.email,
      atlas_user_id: user.id,
      entitled: user.entitled,
    }),
  )
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

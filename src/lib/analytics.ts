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
      capture_pageview: false,
      persistence: 'localStorage',
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

// Mailing-list capture, separate from account creation -- lets a visitor
// opt into product updates without creating a PocketBase account. `$set`
// attaches the email to the PostHog person profile (not just the event) so
// it shows up on the contact and can be used for cohorts/exports.
export function subscribeForUpdates(email: string, properties?: Record<string, unknown>) {
  withPostHog((posthog) => posthog.capture('Subscribed for updates', { email, $set: { email }, ...properties }))
}

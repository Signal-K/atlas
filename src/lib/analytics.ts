import posthog from 'posthog-js'

// No-ops when VITE_POSTHOG_KEY isn't set (local dev, CI) so nothing has to
// guard every capture() call with an "is analytics configured" check.
const apiKey = import.meta.env.VITE_POSTHOG_KEY as string | undefined
let initialized = false

export function initAnalytics() {
  if (!apiKey || initialized) return
  posthog.init(apiKey, {
    api_host: (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com',
    capture_pageview: false,
    persistence: 'localStorage',
  })
  initialized = true
}

export function trackEvent(name: string, properties?: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent('atlas:analytics-event', { detail: { name, properties } }))
  if (!initialized) return
  posthog.capture(name, properties)
}

// Mailing-list capture, separate from account creation -- lets a visitor
// opt into product updates without creating a PocketBase account. `$set`
// attaches the email to the PostHog person profile (not just the event) so
// it shows up on the contact and can be used for cohorts/exports.
export function subscribeForUpdates(email: string, properties?: Record<string, unknown>) {
  if (!initialized) return
  posthog.capture('Subscribed for updates', { email, $set: { email }, ...properties })
}

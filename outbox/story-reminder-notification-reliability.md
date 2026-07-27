---
id: story-reminder-notification-reliability
type: story
epic: epic-guest-experience
title: Fix local reminder notifications silently failing on mobile browsers
status: done
priority: medium
---

# Fix local reminder notifications silently failing on mobile browsers

**As an** Atlas user with a "get ready" reminder set
**I want** the notification to actually appear when it's due
**So that** enabling notifications isn't a false promise on mobile.

Liam's pushback: "It also says notifications won't work in safari mobile,
but I'm pretty sure that's not true." Right to be skeptical — the
permission-request path works fine on mobile Safari (and has since iOS
16.4). The actual bug was one step further along.

## Root cause

`src/lib/getReadyReminders.ts`'s `scheduleReminder()` fires a local
reminder with `new Notification(...)` called directly from page script.
Per MDN's own documented warning on the `Notification()` constructor:
"This constructor throws a `TypeError` when called in nearly all mobile
browsers... you need to register a service worker and use
`ServiceWorkerRegistration.showNotification()`." So a user could grant
permission successfully, see "Enabled" in the UI, and still never
receive the notification when the reminder actually fired on a mobile
browser — Safari included, but not Safari-specific. The app's own
messaging conflated "permission not supported" with "this specific
mechanism is broken," which is what made "Safari doesn't support
notifications" sound plausible even though it isn't accurate.

Confirmed the correct API is already used elsewhere in the codebase:
`src/sw.ts`'s `push` event handler already calls
`self.registration.showNotification(...)` for real server-sent push
messages — only the local/`setTimeout`-scheduled path had the bug.

## Acceptance criteria

- [x] Local "get ready" reminders display via the service worker
      (`ServiceWorkerRegistration.showNotification()`) instead of the
      page-context `Notification()` constructor.
- [x] Falls back to the old constructor only when no service worker is
      registered at all (rare — very old/non-PWA-capable browsers),
      rather than assuming one path universally.

## Implementation

`src/lib/getReadyReminders.ts`'s `scheduleReminder()`: when
`'serviceWorker' in navigator`, awaits `navigator.serviceWorker.ready`
and calls `registration.showNotification(...)` with the same title/body/
tag as before. This is a locally-triggered call, not a response to a
remote `push` event — no server round-trip needed, same as the previous
behavior, just through the API that actually works cross-browser.

Directly relevant to the guest-notification path added in
`OnboardingFlow` the same week (guests get `Notification` permission via
`ensureNotificationPermission()` with no account) — this fix is what
makes that permission grant actually result in a notification arriving,
on mobile Safari and other mobile browsers alike.

## Follow-up fix: onboarding stuck on "Enabling..."

Reported straight after the fix above shipped: the onboarding "Enable
notifications" button got stuck showing "Enabling…" forever for some
users.

Root cause was one function over: `ensureNotificationPermission()`
(same file) awaits `subscribeToPush()` as a best-effort sync, but only
when the user is already signed in — and `subscribeToPush()` itself
awaits `navigator.serviceWorker.ready`, a promise that never resolves at
all if the service worker fails to register or activate for any reason.
That sync is a bonus on top of the local permission grant the caller
actually needs, so a stuck service worker was blocking the entire
onboarding flow indefinitely with no way out — a `try/catch` doesn't
help here, since an unresolved promise never throws.

**Fix**: wrapped the `subscribeToPush()` call in a 6-second timeout
(`withTimeout()` helper, same file) so a broken/slow service worker can
no longer hang the whole permission flow. Local notifications still get
enabled either way, matching the existing "browser notifications are
still available as a local fallback" comment that already assumed
`subscribeToPush()` could fail outright — just not that it could hang
instead of failing.

## Follow-up fix: notification prompt appears twice, then dismisses itself

Reported next: the browser's native permission prompt would flash up
twice in a row and disappear before there was time to tap "Allow."

Root cause: `OnboardingFlow`'s "Enable notifications" button disables
itself via `disabled={pushBusy}`, but that only takes effect on the next
React render — inside the same click gesture (a fast double-tap is
common on mobile, where `touchstart`/`click` can both land before a
re-render commits), `enableNotifications()` could run twice before the
disabled state ever painted. Two overlapping
`Notification.requestPermission()` calls made the native prompt
render, get pre-empted by the second call, and dismiss itself — never
giving either one a chance to be answered.

**Fix**: `OnboardingFlow.tsx` now guards `enableNotifications()` with a
`useRef` flag checked and set synchronously at the top of the function,
before any state update or async work — a second call within the same
tick returns immediately instead of starting a competing permission
request. `useRef` updates synchronously (unlike `useState`), so it
closes the exact gap the disabled-button attribute couldn't.

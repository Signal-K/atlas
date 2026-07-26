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

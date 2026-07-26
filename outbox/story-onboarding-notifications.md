---
id: story-onboarding-notifications
type: story
epic: epic-onboarding
title: "Onboarding: capture notification preferences"
status: done
priority: medium
---

# Onboarding: capture notification preferences

**As a** new Atlas user
**I want** to set my reminder/notification preferences during onboarding
**So that** Atlas doesn't either spam me or stay silent by default before
I've thought about it.

## Acceptance criteria

- [x] First-run onboarding includes a notifications step (push opt-in).
- [x] Step is skippable and remains editable later from Settings
      (`PushSettings`, unchanged).
- [x] Handles the signed-out case (push requires sign-in) without
      blocking the flow.

## Implementation

`OnboardingFlow`'s "notifications" step reuses `isPushSupported` and
`subscribeToPush` from `src/lib/push.ts` (same functions `PushSettings`
uses). Signed-out users see a "sign in later, then enable from Settings"
message instead of a broken enable button, since `subscribeToPush`
requires an authenticated session.

## Follow-up fix: guests get real notifications too

Liam asked to make skipping signup at onboarding "less punishing" and
lean on cookies/browser storage instead of an account wherever possible.
The signed-out message above was a dead end: it told guests to "sign in
later," even though Atlas already has a fully-working notification path
that needs no account at all — local "get ready" reminders
(`src/lib/getReadyReminders.ts`), backed by `localStorage` plus the
browser's own `Notification` permission, scheduled client-side with
`setTimeout`/`scheduleStoredReminders()`. `ensureNotificationPermission()`
in that same file already requests browser permission unconditionally and
*separately* best-effort upgrades to synced server push only if signed
in — but the onboarding step was calling `subscribeToPush()` directly
instead, which throws for anyone without a session.

Changed `OnboardingFlow` to call `ensureNotificationPermission()` instead,
gated on browser `Notification` support (not `isPushSupported()`, which
also requires a service worker + VAPID key just for the sync layer).
Guests now get a real "Enable notifications" button and working local
reminders immediately; the copy adds "Sign in later to also get notified
on other devices" as a bonus rather than a requirement. Verified with a
Playwright run against a signed-out session — the step now offers "Enable
notifications" instead of the old dead-end message.

## Known gap

There's no step for reminder-type granularity (e.g. "notify me for
meteor showers but not ISS passes") — only a single push on/off toggle,
same as the existing `PushSettings`. Finer-grained reminder preferences
would be a separate story if wanted.

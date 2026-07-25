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

## Known gap

There's no step for reminder-type granularity (e.g. "notify me for
meteor showers but not ISS passes") — only a single push on/off toggle,
same as the existing `PushSettings`. Finer-grained reminder preferences
would be a separate story if wanted.

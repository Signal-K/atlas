---
id: story-onboarding-name
type: story
epic: epic-onboarding
title: "Onboarding: capture display name"
status: done
priority: medium
---

# Onboarding: capture display name

**As a** new Atlas user
**I want** to tell Atlas what to call me
**So that** the feed greeting feels personal.

## Acceptance criteria

- [x] User can set a display name.
- [x] Name persists across sessions.
- [x] Name is editable later.

## Implementation / next step

Shipped as a local-only preference (`src/lib/displayName.ts`), editable
inline from the feed greeting (`WeekConditionsStrip`) and now also the
first step of the new first-run `OnboardingFlow`
(`src/components/OnboardingFlow.tsx`). It is still **not** synced to the
PocketBase user record — it's per-device. A future improvement would be a
PocketBase `users` field (migration needed) captured during sign-up
instead of a localStorage value, so the name follows the account across
devices.

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

Shipped this session as a local-only preference
(`src/lib/displayName.ts`, editable inline from the new feed greeting in
`WeekConditionsStrip`). It is **not** yet part of a first-run onboarding
sequence and is **not** synced to the PocketBase user record — it's
per-device. A proper onboarding flow would want this as a PocketBase
`users` field (migration needed) captured during sign-up rather than a
localStorage value.

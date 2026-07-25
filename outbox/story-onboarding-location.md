---
id: story-onboarding-location
type: story
epic: epic-onboarding
title: "Onboarding: capture location"
status: done (pre-existing)
priority: high
---

# Onboarding: capture location

**As a** new Atlas user
**I want** Atlas to ask for/confirm my location early
**So that** every recommendation is local from the first screen.

## Acceptance criteria

- [x] App requests device location on first entry.
- [x] User can set a manual city if location access is denied/unavailable.

## Status

Already implemented pre-session via `useLocationSeed`
(`src/lib/geo.ts`) and manual-city fallback (`useCurrentLocation`,
`LocationSearchInput.tsx`). Logged here for traceability against the
notes — no code change made this session.

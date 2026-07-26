---
id: story-onboarding-location
type: story
epic: epic-onboarding
title: "Onboarding: capture location"
status: done
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
notes — originally no code change made this session, but see the fix
below from a later bug report.

## Follow-up fix (bug report, in chat)

Liam reported: "If I've already given it permission to use my location, I
can't confirm it and have to manually select an option." Root cause: the
location step's primary "Use this location" button only ever activated
once a city was picked from the search dropdown (`disabled={!chosenCity}`)
— even when geolocation had already resolved a real location shown right
above it ("Currently using X"). The actual confirm action was a
low-emphasis text-only "Looks good" link next to it, easy to miss, so a
signed geolocation permission still left users with no working way to
confirm it short of typing a search query.

Fixed in `src/components/OnboardingFlow.tsx`: collapsed to a single
always-enabled primary button — "Use this location" if a city was
searched and picked, "Looks good" (confirming the already-detected
location) otherwise. Verified with a live browser test (Playwright)
against a fresh onboarding run.

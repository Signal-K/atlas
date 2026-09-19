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

## Follow-up fix 2 — geolocation left no durable home (ASV-53)

Two bugs in the same handler, both found while rebuilding this step for
the eight-step flow:

1. **A granted permission persisted nothing durable.** The handler fired
   the GPS request without awaiting it and never wrote a home, so the
   only record of the user's location was `geo.ts`'s 30-day
   `atlas-location-cache` — rounded to ~1 decimal degree, with no name
   and no timezone. Once that expired, `useCurrentLocation` fell through
   to the hardcoded Melbourne default, with nothing on screen explaining
   why the app thought the user was in Australia.
2. **A denial destroyed the home they already had.** The handler called
   `setManualLocation?.(null)` *before* awaiting the browser's answer, so
   declining the prompt deleted a perfectly good stored home and left the
   user with no location at all.

Fixed by inverting the order and persisting a real home on success: the
request is awaited first, and a fix is reverse-geocoded to a name and
saved through the same `MANUAL_LOCATION_KEY` store the search path uses
(`setManualLocation`), so home now survives the cache expiring. The
timezone comes from `Intl.DateTimeFormat().resolvedOptions().timeZone`,
which is the right zone precisely because the user is physically at that
location at that moment — the old geo-only path carried no timezone at
all. On refusal or failure the handler leaves any existing home exactly
as it was and still shows the search-instead error. Rounding stays at ~1
decimal degree: this is a named home, not a precise track, and the
device-local promise at `LocationSettings` is unchanged.

Related, though not part of the location step: `activeTripFor`
(`src/lib/trips.ts`) returned the *soonest*-starting trip covering a
date, so a handover day belonged to the trip the user had just left.
Perth 24–27 followed by Darwin 27–30 showed Perth on the 27th — wrong
city, wrong forecast, on the one day it mattered most. The
later-starting trip now wins, since a trip beginning that day supersedes
one ending it.

Both are pinned in `e2e/landing-location-flow.spec.ts`: the home test
deletes the geo cache *and* withdraws the browser permission before
reloading, so only a persisted home can still answer; the refusal test
stubs the failure rather than relying on how headless Chromium treats an
unanswered prompt.

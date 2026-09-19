---
id: epic-onboarding
type: epic
title: Onboarding overhaul
status: done
priority: high
source: "Notebook page 1, 'Onboarding overhaul' section"
---

# Onboarding overhaul

New/returning users should be walked through:

- Name (what should Atlas call you)
- Interests (what kind of sky events they care about)
- Location
- Notification / reminder preferences

## Child stories

- story-onboarding-name
- story-onboarding-location
- story-onboarding-equipment
- story-onboarding-interests
- story-onboarding-experience
- story-onboarding-club
- story-onboarding-notifications
- story-onboarding-purpose-survey

## Status

All four steps now ship as a single first-run `OnboardingFlow`
(`src/components/OnboardingFlow.tsx`): name → interests → location →
notifications, each skippable, each starting pre-filled from whatever's
already known (existing location, existing interests from mobile, etc).
Triggered once per device on `App.tsx` right after a user enters the app,
gated by `hasCompletedOnboardingFlow()`.

Three of the four steps picked up real bug fixes in a later chat session
-- see the "Follow-up fix" sections on `story-onboarding-location`
(confirm-button stuck disabled), `story-onboarding-interests`
(confusing pre-fill copy), and `story-onboarding-notifications` (guests
couldn't get notifications at all; then a second fix in
`story-reminder-notification-reliability` for the "stuck on
'Enabling...'" bug that followed).

## Overhaul to eight steps (ASV-53)

A later request replaced the four steps with eight, split by question
rather than combined, so each gets its own screen and its own skip:

    name -> location -> equipment -> interests
         -> experience -> clubs -> notifications -> survey

`name` stays first because the feed greets the user by name and
`notifications` stays a permission ask after the questions; the survey is
last. Progress bars and the `STEP n OF 8` kicker derive from
`STEPS.length`, so no CSS hardcodes a count.

The three new scalar answers (equipment, experience, club) have no
existing local store, so they're staged in `atlas-onboarding-answers`
(`src/lib/onboarding.ts`) and pushed by `syncOnboardingToAccount()` at
sign-up — the same guest-then-merge shape interests already used through
Dexie favourites. Server-side they land on the `users` collection, added
by `39_atlas_onboarding_answers.go` in the shared `~/Navigation/backend`.

**The gate became a version, not a boolean.** `ONBOARDING_VERSION = 2`
(`src/lib/onboarding.ts`); the stored completion marker now holds the
version this browser finished and the gate compares it `>=`. A boolean
could not express "completed, but by an older, shorter flow", so the
overhaul could not otherwise reach people who had already onboarded once
— which was the explicit requirement. `users.onboarding_version` carries
the same across devices, backfilled to `1` for accounts with
`onboarded = true`. The regression this deliberately avoids is in
`useOnboardingGate.handleSignedIn()`: it used to mark the flow complete
unconditionally on every sign-in, which with a versioned gate would stamp
the current version on a returning user who never saw the new steps.

Two long-standing bugs inside the flow were fixed rather than carried
into the rewrite:

- **Geolocation left no durable home.** The old handler fired the GPS
  request without awaiting it and persisted nothing, so a granted
  permission produced only `geo.ts`'s 30-day cache — after which the user
  silently reverted to the hardcoded Melbourne default — while a denial
  destroyed the home they already had. See `story-onboarding-location`.
- **A trip handover day resolved to the wrong trip.** `activeTripFor`
  returned the soonest-starting match, so Perth 24–27 followed by Darwin
  27–30 showed Perth on the 27th. The later-starting trip now wins.

Also in scope: `InterestsPicker`'s chips rendered as unstyled
browser-default buttons — it emitted `.interests-picker` /
`.interests-picker-chip`, neither of which exists in any stylesheet. It now
uses the shared `az-chip` classes.

Coverage added alongside: `e2e/landing-location-flow.spec.ts` pins the
handover-day rule as a table of days, and pins both geolocation bugs (a
persisted home surviving the cache being deleted *and* the browser
permission being withdrawn, and a refusal leaving an existing home
untouched). `e2e/tsconfig.json` is new and wired into the solution
`tsconfig.json`, so `npm run build` now typechecks the Playwright specs —
they had been typechecked by nothing, and a stale seed could only surface
as a mid-suite runtime failure.

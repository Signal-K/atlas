---
id: epic-onboarding
type: epic
title: Onboarding overhaul
status: done
priority: medium
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
- story-onboarding-interests
- story-onboarding-location
- story-onboarding-notifications

## Status

All four steps now ship as a single first-run `OnboardingFlow`
(`src/components/OnboardingFlow.tsx`): name → interests → location →
notifications, each skippable, each starting pre-filled from whatever's
already known (existing location, existing interests from mobile, etc).
Triggered once per device on `App.tsx` right after a user enters the app,
gated by `hasCompletedOnboardingFlow()`.

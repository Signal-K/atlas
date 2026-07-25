---
id: epic-onboarding
type: epic
title: Onboarding overhaul
status: in-progress
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

Location capture already existed via the location-permission/manual-city
flow. Display name capture shipped this session as a lightweight
localStorage preference surfaced in the new feed greeting
(`src/lib/displayName.ts`). Interests and notification preferences are not
yet part of a first-run onboarding sequence — `EventPreferencePrompt` and
`PushSettings` exist as standalone components but aren't stitched into a
single onboarding flow yet.

---
id: story-onboarding-interests
type: story
epic: epic-onboarding
title: "Onboarding: capture interests"
status: done
priority: medium
---

# Onboarding: capture interests

**As a** new Atlas user
**I want** to pick the kinds of sky events I care about during onboarding
**So that** my feed and recommendations are tuned from day one instead of
defaulting to everything.

## Acceptance criteria

- [x] First-run onboarding includes an interests step using the existing
      event category list.
- [x] Selections save to the same store `EventPreferencePrompt` already
      writes to, so mobile's existing preference filtering picks them up
      immediately.
- [x] Step is skippable.

## Implementation

`src/components/OnboardingFlow.tsx`'s "interests" step uses the shared
`InterestsPicker` (`src/components/InterestsPicker.tsx`) and
`savePreferredEventTypes` (`src/lib/eventPreferences.ts`) — the same store
`EventPreferencePrompt` uses on mobile, so completing this step also
dismisses mobile's own interests prompt.

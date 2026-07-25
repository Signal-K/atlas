---
id: story-onboarding-interests
type: story
epic: epic-onboarding
title: "Onboarding: capture interests"
status: backlog
priority: medium
---

# Onboarding: capture interests

**As a** new Atlas user
**I want** to pick the kinds of sky events I care about during onboarding
**So that** my feed and recommendations are tuned from day one instead of
defaulting to everything.

## Acceptance criteria

- [ ] First-run onboarding includes an interests step using the existing
      event category list.
- [ ] Selections save to the same store `EventPreferencePrompt` already
      writes to, so mobile's existing preference filtering picks them up
      immediately.
- [ ] Step is skippable.

## Notes for implementation

Reuse `src/components/mobile/EventPreferencePrompt.tsx` and
`src/lib/eventPreferences.ts` rather than building new interest storage —
this is primarily about placing that existing picker into a first-run
onboarding sequence (see epic-onboarding) instead of wherever it's
currently triggered from.

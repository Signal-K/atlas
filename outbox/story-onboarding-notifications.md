---
id: story-onboarding-notifications
type: story
epic: epic-onboarding
title: "Onboarding: capture notification preferences"
status: backlog
priority: medium
---

# Onboarding: capture notification preferences

**As a** new Atlas user
**I want** to set my reminder/notification preferences during onboarding
**So that** Atlas doesn't either spam me or stay silent by default before
I've thought about it.

## Acceptance criteria

- [ ] First-run onboarding includes a notifications step (push opt-in +
      reminder-type preferences).
- [ ] Step is skippable and remains editable later from Settings.

## Notes for implementation

`src/components/PushSettings.tsx` and `src/lib/push.ts` already implement
push opt-in and preferences as a standalone Settings section — this story
is about placing that into the first-run onboarding sequence (see
epic-onboarding) rather than building new notification plumbing.

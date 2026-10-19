---
id: story-onboarding-equipment
type: story
epic: epic-onboarding
title: "Onboarding: capture viewing equipment"
status: done
priority: high
---

# Onboarding: capture viewing equipment

**As a** new Atlas user
**I want** to say what I'll actually observe with
**So that** Atlas stops recommending things my gear can't show me.

## Acceptance criteria

- [x] Onboarding asks whether the user observes with their eyes, binoculars, a
      telescope, or some combination.
- [x] Multi-select — someone with binoculars *and* a scope answers once.
- [x] The answer is saved, not just held in React state.

## Status

Step 3 of the eight-step flow (ASV-53). Multi-select chips reusing
`VIEWING_INSTRUMENTS` from `src/lib/tripPlans.ts` unchanged, so the ids
written here (`naked_eye` / `binoculars` / `telescope`) are the same
vocabulary `ItineraryBuilderSheet` and Profile settings already filter
on — an answer given during onboarding is immediately usable by those
without a translation layer.

Storage is `users.viewing_instruments` (`SelectField`, `MaxSelect: 3`),
added by `39_atlas_onboarding_answers.go` in the shared backend. A guest
answers into `atlas-onboarding-answers` in localStorage
(`src/lib/onboarding.ts`) and `syncOnboardingToAccount()` pushes it at
sign-up.

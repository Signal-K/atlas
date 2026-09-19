---
id: story-onboarding-experience
type: story
epic: epic-onboarding
title: "Onboarding: capture astronomy experience level"
status: done
priority: medium
---

# Onboarding: capture astronomy experience level

**As** someone who has never used a star app
**I want** Atlas to know roughly how much astronomy I've done
**So that** it can pitch its explanations at me instead of guessing.

## Acceptance criteria

- [x] Onboarding asks for a self-assessed experience level.
- [x] Single-select over four plain-language levels rather than a fine scale.
- [x] The answer is saved.

## Status

Step 5 of the eight-step flow (ASV-53). Four buckets —
`beginner` / `casual` / `experienced` / `expert` — each with a
one-line hint so the choice is about the description, not the label
(`EXPERIENCE_LEVELS` in `src/lib/onboarding.ts`).

Deliberately coarse: this is a self-assessment, not a skill test, and
its only job is deciding how much the app explains. A finer scale would
just produce inconsistent answers. Stored on `users.experience_level`
(`SelectField`, `MaxSelect: 1`); guests stage it locally and push it at
sign-up, same as equipment and clubs.

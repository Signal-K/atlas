---
id: story-onboarding-club
type: story
epic: epic-onboarding
title: "Onboarding: ask about astronomy club membership"
status: done
priority: low
---

# Onboarding: ask about astronomy club membership

**As** Atlas
**I want** to know whether the user belongs to a local astronomy club
**So that** I can calibrate how social and how group-oriented the product
should feel for them.

## Acceptance criteria

- [x] Onboarding asks whether the user is part of a local astronomy club.
- [x] A "yes" can carry the club's name; saying no doesn't demand one.
- [x] Both answers are saved.

## Status

Step 6 of the eight-step flow (ASV-53). Yes/No with an optional name
field revealed on "yes" — the name is a convenience for later features,
never a requirement to get past the step.

Stored as `users.in_astro_club` (`BoolField`) plus
`users.astro_club_name` (`TextField`, 120 chars). The name is cleared
when the answer flips back to "no", so a stale club can't linger on the
record after someone leaves one.

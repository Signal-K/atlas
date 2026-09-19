---
id: story-onboarding-purpose-survey
type: story
epic: epic-onboarding
title: "Onboarding: ask what they want to use Atlas for"
status: done
priority: medium
---

# Onboarding: ask what they want to use Atlas for

**As** Atlas
**I want** one open-ended question about what the user came for
**So that** the product has a stated intent to design against, not just
inferred behaviour.

## Acceptance criteria

- [x] The step asks what the user wants to use Atlas for.
- [x] It runs as a real PostHog survey, not a bespoke form posting nowhere.
- [x] Responses land in PostHog with `$survey_id` so they're queryable.
- [x] Skipping is a dismissal, not a fake answer.

## Status

Step 8 — the last step of the eight-step flow (ASV-53). Provisioned by
`scripts/posthog-surveys-setup.mjs` and consumed through
`VITE_POSTHOG_ONBOARDING_SURVEY_ID`.

Runs **headless** (PostHog `type: 'api'`) and renders in Atlas's own
markup rather than PostHog's injected widget, so the last step of
onboarding looks like the other seven instead of like a third-party
overlay. PostHog's display logic is not used at all: the step dedupes
through a localStorage key and captures `survey shown` / `survey sent` /
`survey dismissed` itself with the survey's id attached.

Two deliberate departures from how the rest of Atlas consumes surveys
(`FeedbackDock`):

- The step renders whether or not the survey is configured. Gating it on
  `getActiveSurveys()` — or on the id being set — would make step 8 of 8
  silently vanish whenever PostHog is unset, unreachable, or the survey
  is paused, breaking both the step count the progress bar promises and
  the "always ask" intent. The id only decides which schema the answer is
  reported under; without it, the answer is recorded as an Atlas event
  (`Onboarding survey submitted`) rather than dropped.
- Because the flow captures the response rather than PostHog's widget, it
  pins the question id (`ONBOARDING_SURVEY_QUESTION_ID`, mirrored in the
  setup script) and sends **both** `$survey_response` and
  `$survey_response_<question_id>` — PostHog's own SDKs set the former
  while question-level breakdowns read the latter for a multiple-choice
  question, so sending both makes the answer queryable either way.

The planned extraction of `FeedbackDock`'s `surveyIsActive` helper turned
out not to be needed: this step never consults the active-survey list, so
there was nothing to share.

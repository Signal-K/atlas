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

## Follow-up fix (bug report, in chat)

Liam reported the picker felt "confusing because everything is selected
at the start." Verified in a live browser against a genuinely fresh
account: the picker does start blank, as intended (`getPreferredEventTypes()`
resolves to `[]` for a new local scope) — this wasn't reproducible as a
plain logic bug. The real trigger: interests saved on one device sync to
the account server-side, but `hasCompletedOnboardingFlow()` is a
local-only flag, so a returning user on a *new* device/browser sees this
step re-appear pre-filled with their real prior picks and no explanation
why — reads as "the multi-select is stuck on select-all."

Fixed by explaining the pre-fill rather than removing it (removing it
would silently discard a real signal about what the user already told
Atlas): `OnboardingFlow` now tracks whether the initial fetch returned any
saved kinds and swaps the subtitle to "Pre-filled from what you already
follow — tap any you want to remove" in that case, keeping the original
"Atlas will prioritise these..." copy only for the truly-fresh case.

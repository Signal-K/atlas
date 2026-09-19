// The final onboarding step: a headless PostHog survey asking what the user
// wants to use Atlas for.
//
// "Headless" (PostHog survey type 'api') means PostHog never injects its own
// widget -- OnboardingFlow renders this with Atlas's own markup, inside the
// flow, and reports back with the standard survey events. That keeps the step
// visually part of onboarding instead of a third-party overlay appearing over
// it, which is what "a minimal, styled posthog survey" has to mean inside an
// eight-step flow.
//
// The step renders whether or not the survey is configured. Gating its
// existence on the survey being live would make step 8 of 8 silently vanish
// whenever PostHog is unset, unreachable or the survey is paused -- breaking
// both the step count the progress bars promise and the "always ask" intent.
// The id only decides which schema the answer is reported under.
import { trackEvent } from './analytics'

export const ONBOARDING_SURVEY_ID = import.meta.env.VITE_POSTHOG_ONBOARDING_SURVEY_ID as string | undefined

// Pinned in scripts/posthog-surveys-setup.mjs. PostHog keys a multiple-choice
// response as `$survey_response_<question_id>`, so this has to match the
// created question or the answer lands under a key nothing reads. Kept here
// rather than derived at runtime because the id is only discoverable from the
// PostHog dashboard otherwise -- and a dashboard edit would then silently
// orphan the key with no error anywhere.
export const ONBOARDING_SURVEY_QUESTION_ID = 'a3f1c0d2-7b4e-4c58-9e21-6d0a8b5f4c73'

// Rendered as the step's chips, and posted as the survey's answer. Duplicated
// in scripts/posthog-surveys-setup.mjs (a .mjs script can't import this TS
// module) -- the two lists have to be edited together, or the survey object
// knows choices the app never shows and vice versa.
export const ONBOARDING_SURVEY_CHOICES = [
  'Knowing what to look for tonight',
  'Learning the sky as a beginner',
  'Planning sessions with my telescope',
  'Photographing the sky',
  'Not missing rare events',
  'Sharing the sky with others',
]

const SURVEY_STATE_KEY = 'atlas-onboarding-survey-state'

function readState(): string | null {
  try {
    return localStorage.getItem(SURVEY_STATE_KEY)
  } catch {
    return null
  }
}

function writeState(value: string): void {
  try {
    localStorage.setItem(SURVEY_STATE_KEY, value)
  } catch {
    // Best-effort; losing the marker only means PostHog might see a duplicate
    // `survey shown` for this browser.
  }
}

// Fired once when the step is first displayed. Deduped by a local marker so a
// mid-flow reload (or a user who re-runs the flow) doesn't inflate the survey's
// view count -- PostHog's own widget wouldn't double-count either.
export function reportOnboardingSurveyShown(): void {
  if (readState()) return
  writeState('shown')
  if (!ONBOARDING_SURVEY_ID) return
  trackEvent('survey shown', { $survey_id: ONBOARDING_SURVEY_ID, source: 'onboarding' })
}

export function reportOnboardingSurveySubmitted(choices: string[]): void {
  writeState('submitted')
  if (ONBOARDING_SURVEY_ID) {
    trackEvent('survey sent', {
      $survey_id: ONBOARDING_SURVEY_ID,
      // Both response keys, deliberately. For a single-question survey
      // PostHog's own SDKs set $survey_response and the Surveys tab reads it;
      // for a multiple_choice question the answer is an array and the
      // per-question key ($survey_response_<id>) is what question-level
      // breakdowns read. Sending both means the answer is queryable either
      // way, at the cost of one redundant property.
      $survey_response: choices[0],
      [`$survey_response_${ONBOARDING_SURVEY_QUESTION_ID}`]: choices,
      $survey_question_id: ONBOARDING_SURVEY_QUESTION_ID,
      source: 'onboarding',
    })
    return
  }
  // No survey provisioned (local dev, CI, or a deploy where the setup script
  // hasn't run): still record a real event under Atlas's own name rather than
  // dropping the answer on the floor because a third-party id is missing.
  trackEvent('Onboarding survey submitted', { choices, source: 'onboarding' })
}

export function reportOnboardingSurveyDismissed(): void {
  if (!ONBOARDING_SURVEY_ID) return
  trackEvent('survey dismissed', { $survey_id: ONBOARDING_SURVEY_ID, source: 'onboarding' })
}

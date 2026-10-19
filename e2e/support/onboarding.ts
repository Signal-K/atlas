import { expect, type Page } from '@playwright/test'

// Walks OnboardingFlow's click sequence from a Playwright spec.
//
// The step order and headings below mirror the STEPS array in
// src/components/OnboardingFlow.tsx and each step's <h1>. They are duplicated
// rather than imported because that module pulls in React components, the
// PostHog client and import.meta.env -- none of which resolve in the Playwright
// process. (lib/onboarding.ts, by contrast, has no imports and is safe to
// import; e2e/support/auth.ts does exactly that for its version constant.)
//
// The duplication is deliberate and load-bearing. Every skip below asserts the
// heading of the step it is about to leave, so a renamed, reordered or removed
// step fails *here* -- naming the screen the spec actually found -- rather than
// letting the click land on the wrong step and surfacing three steps later as a
// timeout on the app shell, with nothing pointing back at onboarding.
//
// Onboarding renders as an overlay over the app shell and is the only thing on
// screen with these buttons, so the selectors below are unscoped on purpose.

export async function expectOnboardingNameStep(page: Page) {
  await expect(page.getByRole('heading', { name: 'What should Atlas call you?' })).toBeVisible({ timeout: 15_000 })
}

// Step 2 of 8. The name step is the only one before it.
export async function reachOnboardingLocationStep(page: Page) {
  await expectOnboardingNameStep(page)
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByRole('heading', { name: 'Where are you observing from?' })).toBeVisible()
}

async function skipStep(page: Page, heading: string) {
  await expect(page.getByRole('heading', { name: heading })).toBeVisible()
  await page.getByRole('button', { name: 'Skip' }).click()
}

// Steps 3-6: the four questions between the location step and the notifications
// ask. All four are skippable, and skipping equipment still counts as answering
// the first-plan journey's own equipment prompt (OnboardingFlow's skipStep).
export async function skipOnboardingQuestions(page: Page) {
  await skipStep(page, 'What will you observe with?')
  await skipStep(page, 'What do you want to see?')
  await skipStep(page, 'How much astronomy have you done?')
  await skipStep(page, 'Part of a local astronomy club?')
}

// Steps 7-8, then the flow closes. Notifications is the one step with no Skip --
// it offers "Not now" instead, which is the same decline by another name; the
// survey's Skip reports a dismissal rather than an answer.
export async function finishOnboarding(page: Page) {
  await expect(page.getByRole('heading', { name: 'Stay in the loop' })).toBeVisible()
  await page.getByRole('button', { name: 'Not now' }).click()
  await expect(page.getByRole('heading', { name: 'What do you want to use Atlas for?' })).toBeVisible()
  await page.getByRole('button', { name: 'Skip' }).click()
}

// All eight steps, answering none of them. Specs that only care about what
// happens *after* onboarding use this to get past it without asserting anything
// about the flow itself beyond each step being where it says it is.
export async function completeOnboarding(page: Page) {
  await reachOnboardingLocationStep(page)
  await page.getByRole('button', { name: /Use this location|Looks good/ }).click()
  await skipOnboardingQuestions(page)
  await finishOnboarding(page)
}

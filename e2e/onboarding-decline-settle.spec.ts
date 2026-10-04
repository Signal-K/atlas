import { test, expect } from '@playwright/test'
import { seedSignedInUser } from './support/auth'
import { reachOnboardingLocationStep, skipOnboardingQuestions } from './support/onboarding'

// ASV-99: a run of quick taps through onboarding used to land on the
// notifications "Not now" and the survey "Skip" before they were read.

test('the notifications and survey decline buttons hold for a beat when their step arrives', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('atlas-onboarding-flow-required', '1'))
  await seedSignedInUser(page, { onboardingComplete: false })
  await page.goto('/app')
  await reachOnboardingLocationStep(page)
  await page.getByRole('button', { name: /Use this location|Looks good/ }).click()
  await skipOnboardingQuestions(page)

  await expect(page.getByRole('heading', { name: 'Stay in the loop' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Not now' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Not now' })).toBeEnabled({ timeout: 3_000 })
  await page.getByRole('button', { name: 'Not now' }).click()

  await expect(page.getByRole('heading', { name: 'What do you want to use Atlas for?' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Skip' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Skip' })).toBeEnabled({ timeout: 3_000 })
})

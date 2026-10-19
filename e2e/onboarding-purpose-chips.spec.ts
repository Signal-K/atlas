import { test, expect } from '@playwright/test'
import { seedSignedInUser } from './support/auth'
import { reachOnboardingLocationStep, skipOnboardingQuestions } from './support/onboarding'

// ASV-88. The survey chips are reported to PostHog (unchanged) and also kept on
// the device so the training path can read them back after a reload.

test('onboarding purpose chips survive a reload', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('atlas-onboarding-flow-required', '1'))
  await seedSignedInUser(page, { onboardingComplete: false })
  await page.goto('/app')
  await reachOnboardingLocationStep(page)
  await page.getByRole('button', { name: /Use this location|Looks good/ }).click()
  await skipOnboardingQuestions(page)

  await expect(page.getByRole('button', { name: 'Not now' })).toBeVisible()
  await page.getByRole('button', { name: 'Not now' }).click()
  await expect(page.getByRole('heading', { name: 'What do you want to use Atlas for?' })).toBeVisible()
  await page.getByText('Photographing the sky').click()
  await page.getByRole('button', { name: 'Finish' }).click()

  await page.reload()
  const stored = await page.evaluate(
    () =>
      new Promise<string[] | null>((resolve, reject) => {
        const open = indexedDB.open('atlas')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const get = open.result.transaction('purposeChips').objectStore('purposeChips').get('e2e-user')
          get.onsuccess = () => resolve(get.result?.choices ?? null)
          get.onerror = () => reject(get.error)
        }
      }),
  )
  expect(stored).toEqual(['Photographing the sky'])
})

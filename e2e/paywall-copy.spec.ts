import { expect, test } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

// ASV-118: the Planner paywall description contained a stray ASCII "--".
test('planner paywall copy has no stray double hyphen', async ({ page }) => {
  await seedSignedInUser(page, { entitled: false })
  await page.goto('/app/planner')

  const copy = page.getByText(/personalized per-city sky guide/)
  await expect(copy).toBeVisible()
  await expect(copy).not.toContainText('--')
  await expect(copy).toContainText('guide — including')
})

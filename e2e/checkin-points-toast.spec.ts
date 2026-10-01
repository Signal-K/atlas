import { test, expect } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

// ASV-86. Saving tonight's session reports the points that save added.

test('tonight check-in toast shows the points that save earned', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedSignedInUser(page)
  await page.goto('/app/journal')

  await page.getByRole('button', { name: "Log tonight's session" }).click()
  await page.getByPlaceholder('What did you see tonight?').fill('Clear skies, saw Jupiter.')
  await page.getByRole('button', { name: 'Save session' }).click()

  await expect(page.getByText('Session logged · +10 pts. Next: First photo published.')).toBeVisible()
})

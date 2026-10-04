import { test, expect } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

// ASV-92. /hosts deep-links into a self-reported sky night that earns Community.

test('hosts page deep-links into logging a sky night worth 25 Community points', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedSignedInUser(page)
  await page.goto('/hosts')
  await page.getByRole('link', { name: /I went to a sky night/ }).first().click()

  await expect(page).toHaveURL(/\/app\/journal\?sky-night=1/)
  await page.getByPlaceholder('e.g. Tallinn').fill('Tallinn')
  await page.getByRole('button', { name: 'Log sky night' }).click()
  await expect(page.getByText('Sky night logged · +25 pts.')).toBeVisible()

  await page.goto('/app/profile')
  const card = page.getByRole('region', { name: 'Your level' })
  await expect(card).toContainText('25 pts')
  await expect(card.locator('[data-milestone="first-community-night"]')).toHaveAttribute('data-state', 'achieved')
  await expect(card.locator('[data-milestone="first-check-in"]')).toHaveAttribute('data-state', 'open')
})

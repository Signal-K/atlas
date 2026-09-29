import { expect, test } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

test('calendar pager changes the month heading', async ({ page }) => {
  await seedSignedInUser(page, { entitled: false })
  await page.goto('/app/calendar')

  await expect(page.getByRole('heading', { name: 'Calendar', exact: true })).toBeVisible()
  const monthHeading = page.locator('.az-calendar-head strong')
  const initialMonth = await monthHeading.textContent()
  await page.getByRole('button', { name: 'Next month' }).click()
  await expect(monthHeading).not.toHaveText(initialMonth ?? '')
})

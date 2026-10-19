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

// ASV-105: day buttons need names that carry the full date, and the grid
// needs a weekday header row.
test('calendar day buttons are named by full date and the grid has weekday headers', async ({ page }) => {
  await seedSignedInUser(page, { entitled: false })
  await page.goto('/app/calendar')

  await expect(page.locator('.az-calendar-weekdays span')).toHaveCount(7)
  const firstDay = page.locator('.az-calendar-grid button').first()
  await expect(firstDay).toHaveAttribute('aria-label', /\w+day, \w+ 1(, \d+ events?)?$/)
  await expect(page.locator('.az-calendar-grid button[aria-current="date"]')).toHaveCount(1)
})

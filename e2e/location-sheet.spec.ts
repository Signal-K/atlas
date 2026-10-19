import { expect, test } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

// ASV-104: the sheet stayed open after a city was chosen, led with an
// unrelated Sky Pass pitch, and carried a Motion parallax control.

test.beforeEach(async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ timezone: 'Australia/Perth', daily: { time: [], cloud_cover_mean: [], precipitation_probability_mean: [] } }),
  }))
  await page.route('**/geocoding-api.open-meteo.com/**', (route) => route.abort())
  await page.route('**/api/collections/sky_events/records**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ page: 1, perPage: 200, totalItems: 0, totalPages: 0, items: [] }),
  }))
})

test('choosing a city closes the location sheet and applies the city', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedSignedInUser(page, { entitled: false })
  await page.goto('/app/profile')
  await page.getByRole('button', { name: /Location & sensors/ }).click()

  const sheet = page.getByRole('dialog', { name: 'Observing location' })
  await expect(sheet).toBeVisible()
  await expect(sheet.getByText(/Sky Pass lets you browse/)).toHaveCount(0)
  await expect(sheet.getByText('Motion parallax')).toHaveCount(0)

  await sheet.getByPlaceholder('Search city, region, or country').fill('perth')
  const option = sheet.getByRole('option').first()
  await expect(option).toBeVisible()
  await expect(option).toBeInViewport()
  await option.click()

  await expect(sheet).toBeHidden()
  await expect(page.getByRole('button', { name: /Location & sensors/ })).toContainText(/Perth/)
})

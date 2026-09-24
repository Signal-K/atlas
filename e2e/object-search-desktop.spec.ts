import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('atlas-manual-location', JSON.stringify({ name: 'Amsterdam', lat: 52.3676, lon: 4.9041, timeZone: 'Europe/Amsterdam' }))
  })
  await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ timezone: 'Europe/Amsterdam', daily: { time: [], cloud_cover_mean: [], precipitation_probability_mean: [] } }),
  }))
  await page.route('**/api/collections/sky_events/records**', async (route) => {
    const start = new Date(Date.now() + 24 * 3_600_000)
    start.setUTCHours(22, 0, 0, 0)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        page: 1,
        perPage: 200,
        totalItems: 1,
        totalPages: 1,
        items: [{
          id: 'custom-object-window',
          kind: 'deep_sky',
          target: 'custom_object',
          title: 'Custom Object observing window',
          description: 'A local observing window for this test target.',
          content: 'A local observing window for this test target.',
          starts_at: start.toISOString(),
          ends_at: new Date(start.getTime() + 3 * 3_600_000).toISOString(),
          updated: new Date().toISOString(),
        }],
      }),
    })
  })
})

test('object search shows the next local event and opens a readable desktop detail', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/app/hub')
  await page.getByRole('button', { name: 'Search' }).click()
  await page.getByPlaceholder('Events, targets, places, entries').fill('custom object')

  await expect(page.getByText('Objects · next from Amsterdam')).toBeVisible()
  const relatedEvent = page.locator('.az-object-event').filter({ hasText: 'Custom Object observing window' })
  await expect(relatedEvent).toBeVisible()
  await relatedEvent.click()

  const detail = page.locator('.az-entry-detail-body')
  await expect(detail.getByRole('heading', { name: 'Custom Object observing window' })).toBeVisible()
  await expect(detail).toHaveCSS('max-width', '1152px')
  await expect(page.locator('.az-entry-detail-hero')).toContainText('LOCAL VIEWING WINDOW')
  if (process.env.ATLAS_CAPTURE_SCREENSHOTS === '1') {
    await page.screenshot({ path: 'test-results/object-search-desktop.png', fullPage: false, animations: 'disabled' })
  }
})

test('the desktop auth route renders the Atlas gate rather than browser-default controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/app/events')

  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await expect(page.locator('.auth-gate-sky')).toBeVisible()
  await expect(page.locator('.auth-gate-modal')).toHaveCSS('display', 'flex')
  await expect(page.locator('.auth-gate-modal')).toHaveCSS('max-height', '800px')
  await expect(page.getByRole('button', { name: 'Continue' })).toHaveCSS('border-radius', '12px')
})

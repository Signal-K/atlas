import { expect, test } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

// ASV-110: location pill wrapping, shared drawer icons, empty categories.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('atlas-manual-location', JSON.stringify({ name: 'Perth, Western Australia, Australia', lat: -31.95, lon: 115.86, timeZone: 'Australia/Perth' }))
  })
  await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ timezone: 'Australia/Perth', daily: { time: [], cloud_cover_mean: [], precipitation_probability_mean: [] } }),
  }))
  await page.route('**/api/collections/sky_events/records**', (route) => {
    const start = new Date(Date.now() + 3_600_000)
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        page: 1, perPage: 200, totalItems: 1, totalPages: 1,
        items: [{ id: 'polish-saturn', kind: 'planet_event', target: 'saturn', title: 'Saturn after dark', description: 'x', content: 'x', starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 3_600_000).toISOString(), updated: new Date().toISOString() }],
      }),
    })
  })
})

test('a long location name stays on one line in the topbar chip', async ({ page }) => {
  await page.setViewportSize({ width: 406, height: 755 })
  await seedSignedInUser(page, { entitled: false })
  await page.goto('/app/hub')

  const chip = page.getByRole('button', { name: 'Perth, Western Australia, Australia' })
  await expect(chip).toBeVisible()
  await expect(chip).toContainText('Perth')
  await expect(chip).not.toContainText('Australia')
  const height = (await chip.boundingBox())!.height
  expect(height, 'chip must not wrap to two lines').toBeLessThan(48)
})

test('drawer gives every nav item its own icon and hides empty categories', async ({ page }) => {
  await page.setViewportSize({ width: 406, height: 755 })
  await seedSignedInUser(page, { entitled: false })
  await page.goto('/app/hub')
  await page.getByRole('button', { name: /menu/i }).first().click()

  const links = page.getByRole('navigation', { name: 'Primary' }).last().locator('a')
  await expect(links.first()).toBeVisible()
  const icons = await links.evaluateAll((nodes) => nodes.map((n) => n.querySelector('svg')?.innerHTML ?? ''))
  expect(new Set(icons).size, 'each nav item has a distinct icon').toBe(icons.length)

  const counts = page.locator('.az-nav-drawer-link .az-chip-count')
  await expect(counts.filter({ hasText: /^[1-9]/ }).first()).toBeVisible()
  await expect(counts.filter({ hasText: /^0$/ })).toHaveCount(0)
})

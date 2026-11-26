import { test, expect } from '@playwright/test'

test('landing introduces Atlas and opens the feed', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Look up/ })).toBeVisible()
  await page.getByRole('link', { name: /Explore your sky/ }).first().click()
  await expect(page).toHaveURL(/\/app\/hub/)
  await expect(page.getByRole('heading', { name: 'Feed', exact: true })).toBeVisible()
})

test('city matches remain selectable while worldwide search is stalled', async ({ page }) => {
  await page.route('**/v1/search**', async route => { await new Promise(resolve => setTimeout(resolve, 5000)); await route.abort() })
  await page.goto('/app/hub')
  await page.getByRole('button', { name: /Location not set/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Your location' })
  await dialog.getByRole('searchbox', { name: 'Search worldwide' }).fill('Perth')
  await dialog.getByRole('button', { name: /Perth/ }).click({ timeout: 2000 })
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('button', { name: /Perth/ }).first()).toBeVisible()
})

test('browser location completes without waiting for remote services', async ({ page, context }) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: -31.95, longitude: 115.86 })
  await page.route('**/reverse-geocode-client**', () => new Promise(() => {}))
  await page.route('**/v1/forecast**', () => new Promise(() => {}))
  await page.goto('/app/hub')
  await page.getByRole('button', { name: /Location not set/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Your location' })
  await dialog.getByRole('button', { name: 'Use browser location' }).click()
  await expect(dialog).not.toBeVisible({ timeout: 3000 })
  await expect(page.getByRole('button', { name: /Your current location/ }).first()).toBeVisible()
})

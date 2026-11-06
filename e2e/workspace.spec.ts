import { test, expect } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

test.beforeEach(async ({ page }) => {
  await seedSignedInUser(page)
  await page.route('**/api/**', route => route.abort())
  await page.goto('/app/hub')
  await expect(page.getByRole('heading', { name: 'Feed', exact: true })).toBeVisible()
  await page.evaluate(async () => {
    const { db } = await import('/src/lib/db.ts')
    await db.skyEvents.put({ id: 'workspace-meteor', kind: 'meteor_shower', target: 'perseids', title: 'An evening of shooting stars', description: 'Find a dark spot and give your eyes time to adjust.', startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 86400000).toISOString(), updatedAt: new Date().toISOString() })
  })
  await page.reload()
})

test('feed saves into calendar, persists, and exposes event details', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('button', { name: 'Add An evening of shooting stars to calendar' }).click()
  await page.goto('/app/calendar')
  await expect(page.getByRole('button', { name: 'An evening of shooting stars', exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'An evening of shooting stars', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'An evening of shooting stars' })
  await expect(dialog).toContainText('Find a dark spot')
  await dialog.getByRole('button', { name: 'Remove from calendar' }).click()
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByText('Nothing saved yet.')).toBeVisible()
  await page.getByRole('button', { name: 'All events', exact: true }).click()
  await expect(page.getByRole('button', { name: 'An evening of shooting stars', exact: true })).toBeVisible()
})

test('collections open a filtered feed and search narrows the results', async ({ page }) => {
  await page.goto('/app/events')
  await page.getByRole('button', { name: /Meteors & fireballs/ }).click()
  await expect(page.getByRole('heading', { name: 'Meteors & fireballs', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'An evening of shooting stars', exact: true })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('nothing matches this')
  await expect(page.getByText('No events match your search.')).toBeVisible()
})

test('journal saves a real local entry and the layout works on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('navigation').getByRole('link', { name: 'Journal', exact: true }).click()
  await page.getByRole('button', { name: 'Add entry' }).click()
  const dialog = page.getByRole('dialog', { name: 'New journal entry' })
  await dialog.getByLabel('What did you observe?').fill('Moon over Tallinn')
  await dialog.getByLabel('Notes').fill('A clear patch between the clouds.')
  await dialog.getByRole('button', { name: 'Save entry' }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('heading', { name: 'Moon over Tallinn' })).toBeVisible()
  await page.reload()
  await expect(page.getByText('A clear patch between the clouds.')).toBeVisible()
  await page.getByRole('navigation').getByRole('link', { name: 'History', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Moon over Tallinn' })).toBeVisible()
  await page.getByRole('navigation').getByRole('link', { name: 'Skills tree' }).click()
  await expect(page.locator('.skill-node').first()).toContainText('Experienced')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})


test('sidebar has only the requested destinations and skills and history use journal evidence', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const navigation = page.getByRole('navigation', { name: 'Primary' })
  await expect(navigation.getByRole('link')).toHaveCount(6)
  for (const name of ['Feed', 'Journal', 'Skills tree', 'History', 'Settings']) {
    await expect(navigation.getByRole('link', { name, exact: true })).toBeVisible()
  }
  await expect(page.locator('.save-checkbox, input[type="checkbox"]')).toHaveCount(0)
  await navigation.getByRole('link', { name: 'Skills tree' }).click()
  await expect(page.getByRole('heading', { name: 'Skills tree', exact: true })).toBeVisible()
  await expect(page.getByText('Log a night outside', { exact: true })).toBeVisible()
  await navigation.getByRole('link', { name: 'History', exact: true }).click()
  await expect(page.getByText('Your history will grow as you add observations to your journal.')).toBeVisible()
  await navigation.getByRole('link', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Change location' })).toBeVisible()
})

import { test, expect } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

test.beforeEach(async ({ page }) => {
  await seedSignedInUser(page)
  await page.route('**/api/**', route => route.abort())
  await page.route('**/v1/forecast**', route => route.fulfill({ json: { timezone: 'Europe/Tallinn', daily: { time: [new Date().toISOString().slice(0, 10)], cloud_cover_mean: [22], precipitation_probability_mean: [7] } } }))
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


test('sidebar collapse persists and the feed shows source metrics with equipment filters', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await expect(page.getByRole('region', { name: "Tonight's scorecard" })).toContainText('22%')
  await expect(page.getByRole('region', { name: "Tonight's scorecard" })).toContainText('7%')
  await expect(page.getByRole('region', { name: 'Seven-night forecast' })).toContainText('22%')
  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await expect(page.locator('.atlas-workspace')).toHaveClass(/rail-collapsed/)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
  await page.getByRole('button', { name: 'Expand sidebar' }).click()
  await page.evaluate(async () => {
    const { db } = await import('/src/lib/db.ts')
    await db.skyEvents.put({ id: 'scope-only', kind: 'telescope_target', target: 'saturn', title: 'Saturn through a telescope', description: 'Scope-only test event.', startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 86400000).toISOString(), updatedAt: new Date().toISOString() })
  })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Saturn through a telescope', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Telescope', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Saturn through a telescope', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Naked eye', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Saturn through a telescope', exact: true })).toHaveCount(0)
})

test('daily focus selects a calculated target for each observing day', async ({ page }) => {
  const focus = page.getByRole('region', { name: 'Daily observing focus' })
  await expect(focus.getByRole('heading', { name: 'One thing to see' })).toBeVisible()
  await expect(focus.getByRole('heading', { level: 3 })).not.toBeEmpty()
  const days = focus.getByRole('group', { name: 'Choose observing day' }).getByRole('button')
  await expect(days).toHaveCount(7)
  await days.nth(1).click()
  await expect(days.nth(1)).toHaveAttribute('aria-pressed', 'true')
  await expect(focus.locator('time')).toBeVisible()
})

test('education checks understanding and preserves lesson progress', async ({ page }) => {
  await page.getByRole('navigation').getByRole('link', { name: 'Skills tree' }).click()
  const lessons = page.getByRole('region', { name: 'Learn the sky' })
  await lessons.getByText('Let your eyes adjust', { exact: true }).click()
  await lessons.getByRole('button', { name: 'Keep checking a bright phone screen' }).click()
  await expect(lessons.getByRole('status')).toContainText('Not quite')
  await lessons.getByRole('button', { name: 'Spend time away from bright lights' }).click()
  await expect(lessons).toContainText('1 of 3 short lessons completed')
  await page.reload()
  await expect(page.getByRole('region', { name: 'Learn the sky' })).toContainText('1 of 3 short lessons completed')
})

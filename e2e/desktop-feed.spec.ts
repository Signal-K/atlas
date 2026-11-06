import { test, expect } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

test('desktop contains only the feed and persists saved events', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await seedSignedInUser(page)
  await page.route('**/api/**', route => route.abort())
  await page.goto('/app/hub')
  await expect(page.getByRole('heading', { name: 'Feed', exact: true })).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0)
  await expect(page.getByRole('complementary')).toHaveCount(0)
  await expect(page.locator('.nav-shell, .desktop-agenda, .desktop-feed-tabs')).toHaveCount(0)
  await expect(page.locator('.feed-only')).toHaveCSS('background-color', 'rgb(10, 10, 10)')
  await page.evaluate(async () => {
    const { db } = await import('/src/lib/db.ts')
    await db.skyEvents.put({ id: 'desktop-meteor', kind: 'meteor_shower', target: 'perseids', title: 'An evening of shooting stars', description: 'Find a dark spot, settle in, and give your eyes time to adjust.', startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 86400000).toISOString(), updatedAt: new Date().toISOString() })
  })
  await page.reload()
  const post = page.getByRole('article').filter({ hasText: 'An evening of shooting stars' })
  await expect(post).toBeVisible()
  await post.getByRole('button', { name: 'Add to calendar +' }).click()
  await expect(post.getByRole('button', { name: 'Saved ✓' })).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(post.getByRole('button', { name: 'Saved ✓' })).toBeVisible()
  await post.getByRole('button', { name: 'Saved ✓' }).click()
  await expect(post.getByRole('button', { name: 'Add to calendar +' })).toHaveAttribute('aria-pressed', 'false')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('feed is a single column at narrower desktop widths', async ({ page }) => {
  await seedSignedInUser(page)
  await page.route('**/api/**', route => route.abort())
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.goto('/app/hub')
  await expect(page.locator('.feed-only')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('.feed-only')).toHaveCount(0)
})

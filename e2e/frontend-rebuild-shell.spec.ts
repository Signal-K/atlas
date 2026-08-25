import { test, expect } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

// KES-131: basic coverage for the new AppShell/NavShell replacing
// Sidebar/MobileShell. This doesn't assert on area content yet -- each
// area is still a placeholder page until its own rebuild phase lands --
// it asserts the one-shell nav is present, the primary routes render, and
// the shell is responsive (side nav vs mobile drawer) without pulling in
// the old mobile.css palette.

const AREAS = [
  { path: '/app/events', heading: 'Events' },
  { path: '/app/search', heading: 'Explore' },
  { path: '/app/journal', heading: 'Journal' },
  { path: '/app/ask', heading: 'Ask Atlas' },
  { path: '/app/settings', heading: 'Settings' },
]

test.beforeEach(async ({ page }) => {
  await seedSignedInUser(page, { onboardingComplete: true })
})

for (const area of AREAS) {
  test(`${area.heading} area renders inside the new shell`, async ({ page }) => {
    await page.goto(area.path)
    await expect(page).toHaveURL(area.path)
    await expect(page.getByRole('heading', { name: area.heading, exact: true })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  })
}

test('Plan route renders the Sky Pass trip planner entry point', async ({ page }) => {
  await page.goto('/app/plan')
  await expect(page).toHaveURL('/app/plan')
  await expect(page.getByRole('heading', { name: 'Plan a trip', exact: true }).first()).toBeVisible()
})

test('trip planner requires trip dates before adding a city leg', async ({ page }) => {
  await seedSignedInUser(page, { entitled: true, onboardingComplete: true })
  await page.goto('/app/plan')

  const startDate = page.locator('input[type="date"]').nth(0)
  const endDate = page.locator('input[type="date"]').nth(1)
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
  await startDate.fill('2026-09-01')
  await endDate.fill('2026-09-05')
  await page.getByRole('button', { name: 'Continue' }).click()

  const citySearch = page.getByRole('searchbox', { name: 'Search cities' })
  await citySearch.fill('Tallinn')
  await page.getByRole('option', { name: 'Tallinn' }).click()

  await expect(page.getByText('Selected: Tallinn')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add city' })).toBeDisabled()
})

test('nav links switch between areas without a full reload', async ({ page }) => {
  await page.goto('/app/events')
  await expect(page.getByRole('heading', { name: 'Events', exact: true })).toBeVisible()

  await page.getByRole('link', { name: 'Journal' }).click()
  await expect(page).toHaveURL('/app/journal')
  await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible()

  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page).toHaveURL('/app/settings')
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
})

test('bare /app redirects into the events area', async ({ page }) => {
  await page.goto('/app')
  await expect(page).toHaveURL('/app/events')
})

test('unknown /app/* path falls back to the events area', async ({ page }) => {
  await page.goto('/app/does-not-exist')
  await expect(page).toHaveURL('/app/events')
})

test('narrow viewport uses a compact menu for primary navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/events')
  await page.getByRole('button', { name: 'Open menu' }).click()
  const menu = page.getByRole('complementary', { name: 'Mobile menu' })
  await expect(menu.getByRole('link', { name: 'Events', exact: true })).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Explore', exact: true })).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Plan', exact: true })).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Journal', exact: true })).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Settings', exact: true })).toBeVisible()
  await expect(page.locator('.mobile-quick-dock')).toHaveCount(0)
})

test('wide viewport renders the nav as a side nav, not a mobile dock', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/app/events')
  const nav = page.getByRole('navigation', { name: 'Primary' })
  await expect(nav).toBeVisible()
  const box = await nav.boundingBox()
  // Side nav: narrow column, full viewport height.
  expect(box?.width).toBeLessThan(300)
  expect(box?.height).toBeGreaterThan(700)
  await expect(page.getByRole('navigation', { name: 'Event navigation' })).toBeHidden()
})

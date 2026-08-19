import { test, expect } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

// KES-131: basic coverage for the new AppShell/NavShell replacing
// Sidebar/MobileShell. This doesn't assert on area content yet -- each
// area is still a placeholder page until its own rebuild phase lands --
// it asserts the one-shell nav is present, the primary routes render, and
// the shell is responsive (side nav vs bottom tab bar) without pulling in
// the old mobile.css palette.

const AREAS = [
  { path: '/app/events', heading: 'Events' },
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

test('legacy Plan links redirect to Events', async ({ page }) => {
  await page.goto('/app/plan')
  await expect(page).toHaveURL('/app/events')
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

test('narrow viewport renders the nav as a bottom tab bar, not a side nav', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/events')
  const nav = page.getByRole('navigation', { name: 'Primary' })
  await expect(nav).toBeVisible()
  const box = await nav.boundingBox()
  // Bottom tab bar: full viewport width, pinned near the bottom.
  expect(box?.width).toBeGreaterThan(300)
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeGreaterThan(700)
  // The bar must remain a single 64px control row. A previous combination
  // of sticky flex and fixed safe-area rules doubled its height and left the
  // icons stranded in the upper half.
  expect(box?.height).toBeLessThan(80)
  await expect(nav.getByRole('link')).toHaveCount(3)
})

test('wide viewport renders the nav as a side nav, not a bottom tab bar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/app/events')
  const nav = page.getByRole('navigation', { name: 'Primary' })
  await expect(nav).toBeVisible()
  const box = await nav.boundingBox()
  // Side nav: narrow column, full viewport height.
  expect(box?.width).toBeLessThan(300)
  expect(box?.height).toBeGreaterThan(700)
})

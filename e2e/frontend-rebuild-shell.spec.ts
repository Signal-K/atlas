import { test, expect } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

// KES-131: basic coverage for the new AppShell/NavShell replacing
// Sidebar/MobileShell. This doesn't assert on area content yet -- each
// area is still a placeholder page until its own rebuild phase lands --
// it asserts the one-shell nav is present, the primary routes render, and
// the shell is responsive (side nav vs mobile tab bar) without pulling in
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
    await expect(page.locator('#primary-navigation')).toBeVisible()
  })
}

test('Plan route renders the Sky Pass trip planner entry point', async ({ page }) => {
  await page.goto('/app/plan')
  await expect(page).toHaveURL('/app/plan')
  await expect(page.getByRole('heading', { name: 'Plan a trip', exact: true }).first()).toBeVisible()
})

test('trip planner adds a stop with prefilled stay dates', async ({ page }) => {
  await seedSignedInUser(page, { entitled: true, onboardingComplete: true })
  await page.goto('/app/plan')

  // The builder opens on the itinerary step -- there is no separate
  // trip-dates step; the trip window is derived from the stays. Continue is
  // gated on having at least one stop.
  await expect(page.getByRole('button', { name: /Continue/ })).toBeDisabled()

  // City search is a live-geocoding combobox (curated fallback covers this
  // offline); the option's accessible name carries the place plus its
  // coordinates, so match on the name substring.
  const citySearch = page.getByPlaceholder('Search any town or city')
  await citySearch.fill('Tallinn')
  await page.getByRole('option', { name: /Tallinn/ }).click()

  // Selecting a place reveals its stay dates already prefilled, so the stop
  // can be added in a single tap rather than forcing manual date entry.
  const addStop = page.getByRole('button', { name: 'Add to trip' })
  await expect(addStop).toBeEnabled()
  await addStop.click()

  await expect(page.locator('.trip-itinerary-stop')).toContainText('Tallinn')
  await expect(page.getByRole('button', { name: /Continue/ })).toBeEnabled()
})

test('nav links switch between areas without a full reload', async ({ page }) => {
  await page.goto('/app/events')
  await expect(page.getByRole('heading', { name: 'Events', exact: true })).toBeVisible()

  await page.locator('#primary-navigation').getByRole('link', { name: 'Journal' }).click()
  await expect(page).toHaveURL('/app/journal')
  await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible()

  await page.locator('#primary-navigation').getByRole('link', { name: 'Settings' }).click()
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

test('narrow viewport uses the persistent Atlas tab bar for primary navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/events')
  const tabBar = page.locator('.atlas-tab-bar')
  await expect(tabBar.getByRole('link', { name: 'Tonight', exact: true })).toBeVisible()
  await expect(tabBar.getByRole('link', { name: 'Explore', exact: true })).toBeVisible()
  await expect(tabBar.getByRole('link', { name: 'Plan', exact: true })).toBeVisible()
  await expect(tabBar.getByRole('link', { name: 'Journal', exact: true })).toBeVisible()
  await expect(tabBar.getByRole('link', { name: 'Settings', exact: true })).toBeVisible()
  // The old compact menu was removed; secondary actions remain available
  // through the floating feedback trigger.
  await expect(page.getByRole('button', { name: 'Open menu' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Request feature' })).toBeVisible()
})

test('wide viewport renders the nav as a side nav, not a mobile dock', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/app/events')
  const nav = page.locator('#primary-navigation')
  await expect(nav).toBeVisible()
  const box = await nav.boundingBox()
  // Side nav: narrow column, full viewport height.
  expect(box?.width).toBeLessThan(300)
  expect(box?.height).toBeGreaterThan(700)
  await expect(page.getByRole('navigation', { name: 'Event navigation' })).toBeHidden()
})

import { test, expect } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

// KES-131 (superseded by the Atlas Mobile design rebuild): coverage for the
// AppShell/NavShell driving the 5-tab structure -- Hub, Events, Planner,
// Journal, You (Profile) -- with Search moved out of the tab bar into a
// TopBar-launched overlay. Asserts the one-shell nav is present, the
// primary routes render, and the shell is responsive (side nav vs mobile
// tab bar) without pulling in the old mobile.css palette.

const AREAS = [
  { path: '/app/events', heading: 'Events' },
  { path: '/app/journal', heading: 'Journal' },
  { path: '/app/ask', heading: 'Ask Atlas' },
  { path: '/app/profile', heading: 'You' },
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

test('Hub area renders inside the new shell', async ({ page }) => {
  await page.goto('/app/hub')
  await expect(page).toHaveURL('/app/hub')
  await expect(page.locator('.az-kicker', { hasText: 'after dark' })).toBeVisible()
  await expect(page.locator('#primary-navigation')).toBeVisible()
})

test('Planner route renders the Sky Pass trip planner entry point', async ({ page }) => {
  await seedSignedInUser(page, { entitled: true, onboardingComplete: true })
  await page.goto('/app/planner')
  await expect(page).toHaveURL('/app/planner')
  await expect(page.getByRole('heading', { name: 'Planner', exact: true }).first()).toBeVisible()
})

test('trip planner adds a stop with prefilled stay dates', async ({ page }) => {
  await seedSignedInUser(page, { entitled: true, onboardingComplete: true })
  await page.goto('/app/planner')
  await page.getByRole('button', { name: /Start a plan/ }).click()

  // The builder opens on the itinerary step -- there is no separate
  // trip-dates step; the trip window is derived from the stays. Continue is
  // gated on having at least one stop.
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()

  // City search is a live-geocoding combobox (curated fallback covers this
  // offline); the option's accessible name carries the place plus its
  // coordinates, so match on the name substring.
  const citySearch = page.getByPlaceholder('Search any town or city')
  await citySearch.fill('Tallinn')
  await page.getByRole('option', { name: /Tallinn/ }).click()

  // Selecting a place reveals its stay dates already prefilled, so the stop
  // can be added in a single tap rather than forcing manual date entry.
  const addStop = page.getByRole('button', { name: /to trip$/ })
  await expect(addStop).toBeEnabled()
  await addStop.click()

  await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled()
})

test('trip stay ordering and overlap detection are chronological', async ({ page }) => {
  await page.goto('/app/planner')
  const result = await page.evaluate(async () => {
    const { activeLegFor, dateKeyForTimeZone, sortTripLegs, tripLegIssues } = await import('/src/lib/tripPlans.ts')
    const legs = [
      { id: 'tallinn-return', cityKey: 'tallinn', cityName: 'Tallinn', lat: 59.437, lon: 24.754, startDate: '2026-10-10', endDate: '2026-10-12' },
      { id: 'riga-outbound', cityKey: 'riga', cityName: 'Riga', lat: 56.9496, lon: 24.1052, startDate: '2026-10-03', endDate: '2026-10-05' },
    ]
    const overlapping = [...legs, { id: 'vilnius-overlap', cityKey: 'vilnius', cityName: 'Vilnius', lat: 54.6872, lon: 25.2797, startDate: '2026-10-05', endDate: '2026-10-07' }]
    const sorted = sortTripLegs(legs)
    return {
      route: sorted.map((leg) => leg.cityName),
      active: activeLegFor({ id: 'trip', startDate: '2026-10-03', endDate: '2026-10-12', legs: sorted, equipment: [], interests: [], guides: {} }, new Date('2026-10-04T12:00:00Z'))?.cityName,
      overlapIssues: tripLegIssues(overlapping),
      perthDate: dateKeyForTimeZone(new Date('2026-10-04T23:30:00Z'), 'Australia/Perth'),
    }
  })
  expect(result.route).toEqual(['Riga', 'Tallinn'])
  expect(result.active).toBe('Riga')
  expect(result.overlapIssues).toEqual(['Riga and Vilnius overlap on the same nights.'])
  expect(result.perthDate).toBe('2026-10-05')
})

test('nav links switch between areas without a full reload', async ({ page }) => {
  await page.goto('/app/events')
  await expect(page.getByRole('heading', { name: 'Events', exact: true })).toBeVisible()

  await page.locator('#primary-navigation').getByRole('link', { name: 'Journal' }).click()
  await expect(page).toHaveURL('/app/journal')
  await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible()

  await page.locator('#primary-navigation').getByRole('link', { name: 'You' }).click()
  await expect(page).toHaveURL('/app/profile')
  await expect(page.getByRole('heading', { name: 'You', exact: true })).toBeVisible()
})

test('bare /app redirects into the hub area', async ({ page }) => {
  await page.goto('/app')
  await expect(page).toHaveURL('/app/hub')
})

test('unknown /app/* path falls back to the hub area', async ({ page }) => {
  await page.goto('/app/does-not-exist')
  await expect(page).toHaveURL('/app/hub')
})

test('legacy routes redirect to their new homes', async ({ page }) => {
  await page.goto('/app/plan')
  await expect(page).toHaveURL('/app/planner')

  await page.goto('/app/settings')
  await expect(page).toHaveURL('/app/profile')

  await page.goto('/app/search')
  await expect(page).toHaveURL('/app/hub')

  await page.goto('/app/tonight')
  await expect(page).toHaveURL('/app/hub')

  await page.goto('/tonight')
  await expect(page).toHaveURL('/app/hub')
})

test('narrow viewport uses a hamburger + slide-in drawer for primary navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/events')

  // No persistent bottom tab bar on mobile -- primary nav lives behind the
  // TopBar's hamburger trigger instead (deliberate divergence from the
  // Atlas Mobile design canvas; see AppShell's doc comment).
  await expect(page.locator('.atlas-tab-bar')).toHaveCount(0)
  const trigger = page.getByRole('button', { name: 'Open menu' })
  await expect(trigger).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send feedback' })).toBeVisible()

  await trigger.click()
  const drawer = page.getByRole('dialog', { name: 'Primary navigation' })
  await expect(drawer.getByRole('link', { name: 'Hub', exact: true })).toBeVisible()
  await expect(drawer.getByRole('link', { name: 'All events', exact: true })).toBeVisible()
  await expect(drawer.getByRole('link', { name: 'Planner', exact: true })).toBeVisible()
  await expect(drawer.getByRole('link', { name: 'Journal', exact: true })).toBeVisible()
  await expect(drawer.getByRole('link', { name: 'You', exact: true })).toBeVisible()

  await drawer.getByRole('link', { name: 'Planner', exact: true }).click()
  await expect(page).toHaveURL('/app/planner')
  // Navigating closes the drawer instead of leaving it open over the new area.
  await expect(page.getByRole('dialog', { name: 'Primary navigation' })).toHaveCount(0)
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

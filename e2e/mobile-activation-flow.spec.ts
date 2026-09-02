import { test, expect, type Page } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

async function mockTonightData(page: Page) {
  await page.route('https://api.open-meteo.com/**', async (route) => {
    const days = 7
    const today = new Date()
    const time = Array.from({ length: days }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      return d.toISOString().slice(0, 10)
    })
    const nightlyCloud = [5, 65, 90, 24, 58, 46, 76]
    const nightlyRain = [4, 8, 12, 5, 35, 10, 65]
    const hourlyTime: string[] = []
    const hourlyCloud: number[] = []
    const hourlyRain: number[] = []
    for (let dayIndex = 0; dayIndex <= days; dayIndex += 1) {
      const date = new Date(today)
      date.setDate(date.getDate() + dayIndex)
      const dateKey = date.toISOString().slice(0, 10)
      for (let hour = 0; hour < 24; hour += 1) {
        hourlyTime.push(`${dateKey}T${String(hour).padStart(2, '0')}:00`)
        const nightIndex = hour < 6 ? Math.max(0, dayIndex - 1) : dayIndex
        hourlyCloud.push(hour >= 18 || hour < 6 ? (nightlyCloud[nightIndex] ?? 76) : 5)
        hourlyRain.push(hour >= 18 || hour < 6 ? (nightlyRain[nightIndex] ?? 65) : 0)
      }
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        timezone: 'Europe/London',
        daily: {
          time,
          // Deliberately identical daytime means: the UI must derive its
          // changing night scores from the hourly viewing window below.
          cloud_cover_mean: Array(days).fill(5),
          precipitation_probability_mean: Array(days).fill(0),
        },
        hourly: {
          time: hourlyTime,
          cloud_cover: hourlyCloud,
          cloud_cover_low: hourlyCloud,
          cloud_cover_high: hourlyCloud,
          precipitation_probability: hourlyRain,
        },
      }),
    })
  })

  await page.route('**/api/collections/sky_events/records**', async (route) => {
    const now = new Date()
    // Keep the mocked full moon in Melbourne's night sky. The production
    // feed now correctly hides a global lunar event when its local peak is
    // daytime, which is exactly the regression this fixture must avoid.
    const startsAt = new Date(now.getTime() + 30 * 3_600_000)
    const endsAt = new Date(now.getTime() + 31 * 3_600_000)

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'e2e-mobile-activation-moon',
            kind: 'moon_phase',
            target: 'moon',
            title: 'Full Moon',
            description: 'The Moon reaches its fullest point tonight.',
            content: 'The Moon reaches its fullest point tonight.',
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            updated: now.toISOString(),
          },
        ],
        page: 1,
        perPage: 500,
        totalItems: 1,
        totalPages: 1,
      }),
    })
  })
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockTonightData(page)
})

test('mobile signed-out visitor is blocked by the auth gate before reaching the feed', async ({ page }) => {
  await page.goto('/app/events')

  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Tonight is live|Hold for a better window/ })).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0)
})

test('mobile primary navigation uses the Atlas tab bar', async ({ page }) => {
  await seedSignedInUser(page, { entitled: false })
  await page.addInitScript(() => {
    localStorage.setItem(
      'atlas-manual-location',
      JSON.stringify({ name: 'London', lat: 51.5074, lon: -0.1278, admin1: 'England', country: 'United Kingdom', timeZone: 'Europe/London' }),
    )
  })
  await page.goto('/app/events')

  await expect(page.getByRole('heading', { name: 'Events', exact: true })).toBeVisible({ timeout: 15_000 })
  const tabBar = page.locator('.atlas-tab-bar')
  await expect(tabBar.getByRole('link')).toHaveCount(5)
  await expect(tabBar.getByRole('link', { name: 'Hub', exact: true })).toBeVisible()
  await expect(tabBar.getByRole('link', { name: 'Events', exact: true })).toBeVisible()
  await expect(tabBar.getByRole('link', { name: 'Planner', exact: true })).toBeVisible()
  await expect(tabBar.getByRole('link', { name: 'Journal', exact: true })).toBeVisible()
  await expect(tabBar.getByRole('link', { name: 'You', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Full Moon' })).toBeVisible()
})

test('opening an event covers the tab bar with the detail overlay and retains back control', async ({ page }) => {
  await seedSignedInUser(page, { entitled: false })
  // Pin the location instead of leaving it to real (unmocked) IP
  // geolocation -- an unpredictable resolved city/time zone can shift which
  // calendar day the mocked "Full Moon" event and the local sky-guide
  // fallback land on, silently swapping which one the dock treats as
  // "next". See landing-location-flow.spec.ts for the same pattern.
  await page.addInitScript(() => {
    localStorage.setItem(
      'atlas-manual-location',
      JSON.stringify({ name: 'London', lat: 51.5074, lon: -0.1278, admin1: 'England', country: 'United Kingdom', timeZone: 'Europe/London' }),
    )
  })
  await page.goto('/app/events')

  await expect(page.getByRole('heading', { name: 'Events', exact: true })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Full Moon' }).first().click()
  await expect(page.locator('.az-overlay').getByRole('heading', { name: 'Full Moon' })).toBeVisible({ timeout: 15_000 })

  // The tab bar stays mounted (it no longer unmounts on detail open -- that
  // was causing the flicker/disappear bug) but the full-screen overlay
  // fully covers it, so it isn't interactable.
  await expect(page.locator('.atlas-tab-bar')).toBeVisible()
  await expect(page.locator('.az-overlay')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Event navigation' })).toHaveCount(0)
  // The fixed shell has a known top-layer hit-test quirk in headless
  // Chromium; invoke the real DOM handler so this still verifies the route
  // state transition without pretending the browser's pointer geometry is
  // visually verified here.
  await page.getByRole('button', { name: 'Back' }).evaluate((element) => (element as HTMLButtonElement).click())
  await expect(page.locator('.az-overlay')).toHaveCount(0)
  await expect(page).toHaveURL('/app/events')
})

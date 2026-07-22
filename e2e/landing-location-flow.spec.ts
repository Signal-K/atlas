import { test, expect, type Page } from '@playwright/test'

const APP_URL = `http://localhost:${process.env.PLAYWRIGHT_PORT || '5173'}`

// STS-307: explicit coverage for the landing page's two entry paths.
// Weather and event calls are mocked so this only tests location -> app
// routing, not live data availability.

async function mockTonightData(page: Page) {
  await page.route('https://api.open-meteo.com/**', async (route) => {
    const days = 7
    const today = new Date()
    const time = Array.from({ length: days }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      return d.toISOString().slice(0, 10)
    })

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        daily: {
          time,
          cloud_cover_mean: Array(days).fill(12),
          precipitation_probability_mean: Array(days).fill(4),
        },
      }),
    })
  })

  await page.route('**/api/collections/sky_events/records**', async (route) => {
    const now = new Date()
    const startsAt = new Date(now.getTime() + 2 * 3_600_000)
    const endsAt = new Date(now.getTime() + 3 * 3_600_000)

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'e2e-location-moon',
            kind: 'moon_phase',
            target: 'moon',
            title: 'Full Moon',
            description: 'The Moon reaches its fullest point tonight.',
            content: 'The Moon reaches its fullest point tonight.',
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            latitude: 0,
            longitude: 0,
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
  await mockTonightData(page)
})

test('manual city entry reaches tonight feed with selected city before signup', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'What can I see in the sky tonight?' })).toBeVisible()
  await page.getByLabel('Where are you watching from?').fill('Zur')
  await page.getByRole('button', { name: "See tonight's sky" }).click()

  await expect(page).toHaveURL('/tonight')
  await expect(page.getByRole('heading', { name: 'Tonight near Zurich' })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.account-form')).toHaveCount(0)
})

test('browser geolocation entry reaches tonight feed without signup', async ({ page, context }) => {
  await context.grantPermissions(['geolocation'], { origin: APP_URL })
  await context.setGeolocation({ latitude: 47.3769, longitude: 8.5417 })
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'What can I see in the sky tonight?' })).toBeVisible()
  await page.getByRole('button', { name: 'Use my current location' }).click()

  await expect(page).toHaveURL('/tonight')
  await expect(page.getByRole('heading', { name: 'Tonight near Your location' })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.account-form')).toHaveCount(0)
})

test('location search disambiguates cities by region and country', async ({ page }) => {
  await page.route('https://geocoding-api.open-meteo.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          {
            id: 6058560,
            name: 'London',
            latitude: 42.9834,
            longitude: -81.233,
            admin1: 'Ontario',
            country: 'Canada',
            timezone: 'America/Toronto',
          },
          {
            id: 2643743,
            name: 'London',
            latitude: 51.5074,
            longitude: -0.1278,
            admin1: 'England',
            country: 'United Kingdom',
            timezone: 'Europe/London',
          },
        ],
      }),
    })
  })

  await page.goto('/')
  await page.getByLabel('Where are you watching from?').fill('London')
  await expect(page.getByRole('option', { name: /London Ontario, Canada/ })).toBeVisible()
  await page.getByRole('option', { name: /London Ontario, Canada/ }).click()
  await page.getByRole('button', { name: "See tonight's sky" }).click()

  await expect(page).toHaveURL('/tonight')
  await expect(page.getByRole('heading', { name: 'Tonight near London, Ontario, Canada' })).toBeVisible({ timeout: 15_000 })
})

test('mobile header keeps location switching available after onboarding', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('atlas-entered', '1')
    localStorage.setItem(
      'atlas-manual-location',
      JSON.stringify({ name: 'London', lat: 51.5074, lon: -0.1278, admin1: 'England', country: 'United Kingdom', timeZone: 'Europe/London' }),
    )
  })

  await page.goto('/today')
  await page.getByRole('button', { name: /Change location\. Currently London, England, United Kingdom/ }).click()

  await expect(page).toHaveURL('/settings')
  await expect(page.getByPlaceholder('Search city, region, or country')).toHaveValue('London, England, United Kingdom')
  await page.getByRole('button', { name: 'Back to Atlas' }).click()
  await expect(page).toHaveURL('/today')
})

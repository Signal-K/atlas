import { test, expect, type Page } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

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
        timezone: 'Europe/London',
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

test('index stays on the landing page for a returning signed-out visitor', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('atlas-entered', '1')
    localStorage.setItem('atlas-onboarding-flow-complete', '1')
  })

  await page.goto('/')

  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: 'What can I see in the sky tonight?' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Get started' })).toBeVisible()
  await expect(page.getByText('You’re signed in as')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('index stays on the landing page for a signed-in visitor and identifies the session', async ({ page }) => {
  const tokenPayload = {
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    type: 'auth',
    collectionId: 'users',
  }
  const token = ['e2e', Buffer.from(JSON.stringify(tokenPayload)).toString('base64url'), 'sig'].join('.')

  await page.addInitScript(
    ({ tokenValue }) => {
      localStorage.setItem(
        'pocketbase_auth',
        JSON.stringify({
          token: tokenValue,
          record: {
            id: 'e2e-landing-user',
            email: 'signed-in@example.com',
            entitled: false,
          },
        }),
      )
      localStorage.setItem('atlas-entered', '1')
      localStorage.setItem('atlas-onboarding-flow-complete', '1')
    },
    { tokenValue: token },
  )

  await page.goto('/')

  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: 'What can I see in the sky tonight?' })).toBeVisible()
  await expect(page.getByText('You’re signed in as')).toContainText('signed-in@example.com')
  await expect(page.getByRole('button', { name: 'Open Atlas' }).first()).toBeVisible()
})

// Location is no longer collected on the landing page itself -- it moved
// into OnboardingFlow's "location" step, so it can be asked for after a
// first-time visitor has actually seen what Atlas does, not before. A
// signed-in visitor (seeded above) skips landing entirely -- "/" redirects
// straight to "/app" -- so this goes there directly and clicks past the
// (skippable) name and interests steps first.
async function reachOnboardingLocationStep(page: Page) {
  // Onboarding only runs after authentication. These tests exercise its
  // location step, so seed a newly-created, not-yet-onboarded account here
  // without affecting the returning-account landing-page test above.
  await page.addInitScript(() => localStorage.setItem('atlas-onboarding-flow-required', '1'))
  await seedSignedInUser(page, { onboardingComplete: false })
  await page.goto('/app')
  await expect(page.getByRole('heading', { name: 'What should Atlas call you?' })).toBeVisible()
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByRole('heading', { name: 'What do you want to see?' })).toBeVisible()
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByRole('heading', { name: 'Where are you observing from?' })).toBeVisible()
}

test('manual city entry reaches tonight feed with selected city', async ({ page }) => {
  await reachOnboardingLocationStep(page)

  await page.getByPlaceholder('Search for your town or city').fill('Zur')
  await expect(page.getByRole('option', { name: /Zurich/ })).toBeVisible()
  await page.getByRole('option', { name: /Zurich/ }).click()
  await page.getByRole('button', { name: 'Use this location' }).click()
  await page.getByRole('button', { name: 'Not now' }).click()

  await expect(page).toHaveURL('/app/tonight')
  await expect(page.getByRole('heading', { name: 'Tonight near Zurich' })).toBeVisible({ timeout: 15_000 })
})

test('browser geolocation entry reaches tonight feed', async ({ page, context }) => {
  await context.grantPermissions(['geolocation'], { origin: APP_URL })
  await context.setGeolocation({ latitude: 47.3769, longitude: 8.5417 })

  // useCurrentLocation shows "Your location" only until reverseGeocodeCity
  // resolves, then swaps in the real place name. Left unmocked this hits
  // api.bigdatacloud.net for real, so the heading raced the network: the
  // generic label if the lookup was slow, "Zurich" if it landed first.
  // Pinning the response makes the settled name deterministic.
  await page.route('https://api.bigdatacloud.net/data/reverse-geocode-client**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ city: 'Zurich', locality: 'Zurich', principalSubdivision: 'Zurich' }),
    })
  })

  await reachOnboardingLocationStep(page)

  await page.getByRole('button', { name: 'Use my current location' }).click()
  await page.getByRole('button', { name: 'Not now' }).click()

  await expect(page).toHaveURL('/app/tonight')
  await expect(page.getByRole('heading', { name: 'Tonight near Zurich' })).toBeVisible({ timeout: 15_000 })
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

  await reachOnboardingLocationStep(page)
  await page.getByPlaceholder('Search for your town or city').fill('London')
  await expect(page.getByRole('option', { name: /London Ontario, Canada/ })).toBeVisible()
  await page.getByRole('option', { name: /London Ontario, Canada/ }).click()
  await page.getByRole('button', { name: 'Use this location' }).click()
  await page.getByRole('button', { name: 'Not now' }).click()

  await expect(page).toHaveURL('/app/tonight')
  await expect(page.getByRole('heading', { name: 'Tonight near London, Ontario, Canada' })).toBeVisible({ timeout: 15_000 })
})

test('mobile header keeps location switching available after onboarding', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  // Overrides the beforeEach's onboardingComplete: false -- this test is
  // about the already-onboarded header, not the location step itself.
  await seedSignedInUser(page, { onboardingComplete: true })
  await page.addInitScript(() => {
    localStorage.setItem(
      'atlas-manual-location',
      JSON.stringify({ name: 'London', lat: 51.5074, lon: -0.1278, admin1: 'England', country: 'United Kingdom', timeZone: 'Europe/London' }),
    )
  })

  await page.goto('/app/today')
  await page.getByRole('button', { name: /Change location\. Currently London, England, United Kingdom/ }).click()

  await expect(page).toHaveURL('/app/settings')
  await expect(page.getByPlaceholder('Search city, region, or country')).toHaveValue('London, England, United Kingdom')
  await page.getByRole('button', { name: 'Back to Atlas' }).click()
  await expect(page).toHaveURL('/app/today')
})

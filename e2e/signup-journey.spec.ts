import { expect, test, type Page } from '@playwright/test'
import { makeAuthToken } from './support/auth'

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
          cloud_cover_mean: Array(days).fill(10),
          precipitation_probability_mean: Array(days).fill(5),
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
            id: 'e2e-signup-moon',
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

async function mockAuth(page: Page) {
  const record = {
    id: 'e2e-signup-user',
    email: 'observer@example.com',
    entitled: false,
    collectionId: 'users',
    collectionName: 'users',
  }

  await page.route('**/api/collections/users/records', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(record) })
  })
  await page.route('**/api/collections/users/auth-with-password', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: makeAuthToken(), record }),
    })
  })
  await page.route('**/api/collections/atlas_observations/records', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'remote-observation' }),
    })
  })
}

test.beforeEach(async ({ page }) => {
  await mockTonightData(page)
  await mockAuth(page)
  // Location moved from the landing page into OnboardingFlow's own
  // "location" step -- seed it directly, same as setManualLocation() would.
  await page.addInitScript(() => {
    window.localStorage.setItem('atlas-manual-location', JSON.stringify({ name: 'London', lat: 51.5074, lon: -0.1278 }))
  })
})

// "Get started" now requires an account before onboarding or the app shell
// render at all (see AuthGate in App.tsx) -- signup no longer happens
// after a guest has already saved something locally (that whole flow,
// SignupWallModal, was removed as dead code). This proves the new order:
// landing -> auth gate -> account created -> onboarding -> the feature that
// used to require a signup wall (logging an observation) just works.
test('signup happens via the auth gate before onboarding, then observations save directly', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'What can I see in the sky tonight?' })).toBeVisible()
  await page.getByRole('button', { name: 'Get started' }).click()

  await expect(page.getByRole('heading', { name: 'Create your free account' })).toBeVisible()
  await page.getByPlaceholder('Email').fill('observer@example.com')
  await page.getByPlaceholder('Password').fill('correct-horse-battery')
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect
    .poll(() =>
      page.evaluate(() => {
        const auth = JSON.parse(window.localStorage.getItem('pocketbase_auth') ?? '{}')
        return auth.record?.email
      }),
    )
    .toBe('observer@example.com')

  // Onboarding runs right after account creation, not before it.
  await expect(page.getByRole('heading', { name: 'What should Atlas call you?' })).toBeVisible()
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByRole('heading', { name: 'What do you want to see?' })).toBeVisible()
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByRole('heading', { name: 'Where are you observing from?' })).toBeVisible()
  await page.getByRole('button', { name: 'Looks good' }).click()
  await page.getByRole('button', { name: 'Not now' }).click()

  await expect(page.getByRole('heading', { name: 'Tonight near London' })).toBeVisible({ timeout: 15_000 })

  await page.locator('.tonight-target-main').first().click()
  await page.locator('.equipment-prompt').getByRole('button', { name: 'My phone' }).click()
  await page.getByRole('button', { name: 'Log attempt' }).first().click()

  await expect(page).toHaveURL('/app/history')
  await expect(page.getByText('Logging attempt for')).toBeVisible()
  await page.getByPlaceholder(/What did you see tonight|How did/).fill('Saw the Moon through thin cloud.')
  await page.getByRole('button', { name: 'Good' }).click()
  await page.getByRole('button', { name: 'Save observation' }).click()

  await expect(page.getByText('Saw the Moon through thin cloud.')).toBeVisible()
})

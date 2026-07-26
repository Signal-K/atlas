import { expect, test, type Page } from '@playwright/test'

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
      body: JSON.stringify({ token: 'e2e.signup.token', record }),
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
  // Entering the app from the landing page flips `alreadyEntered`, which
  // would otherwise surface the first-run OnboardingFlow overlay and block
  // every click this journey makes -- this suite isn't testing onboarding,
  // so mark it done upfront.
  await page.addInitScript(() => window.localStorage.setItem('atlas-onboarding-flow-complete', '1'))
})

test('signup appears after observation save, merges local journey, and returns to scrapbook context', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Where are you watching from?').fill('London')
  await page.getByRole('button', { name: "See tonight's sky" }).click()
  await expect(page.getByRole('heading', { name: 'Tonight near London' })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.account-form')).toHaveCount(0)

  await page.locator('.tonight-target-main').first().click()
  await page.locator('.equipment-prompt').getByRole('button', { name: 'My phone' }).click()
  await page.getByRole('button', { name: 'Log attempt' }).first().click()

  await expect(page).toHaveURL('/history')
  await expect(page.getByText('Logging attempt for')).toBeVisible()
  await expect(page.locator('.account-form')).toHaveCount(0)
  await page.getByPlaceholder(/What did you see tonight|How did/).fill('Saw the Moon through thin cloud.')
  await page.getByRole('button', { name: 'Good' }).click()
  await page.getByRole('button', { name: 'Save observation' }).click()

  await expect(page.getByRole('heading', { name: 'Sign up to sync?' })).toBeVisible()
  await page.getByPlaceholder('Email').fill('observer@example.com')
  await page.getByPlaceholder('Password').fill('correct-horse-battery')
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByRole('status')).toContainText('Atlas is watching the sky with you.')
  await expect(page.getByText('3 saved items carried into your account.')).toBeVisible()
  await expect(page).toHaveURL('/history')
  await expect(page.getByText('Saw the Moon through thin cloud.')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const auth = JSON.parse(window.localStorage.getItem('pocketbase_auth') ?? '{}')
        return auth.record?.email
      }),
    )
    .toBe('observer@example.com')
  await expect(page.locator('.account-form')).toHaveCount(0)
})

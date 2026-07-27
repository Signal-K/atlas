import { test, expect, type Page } from '@playwright/test'

const E2E_TOKEN = makeAuthToken()

function makeAuthToken() {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    type: 'auth',
    collectionId: 'users',
  }
  return ['e2e', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'sig'].join('.')
}

function seedSignedInUser(page: Page, entitled: boolean) {
  return page.addInitScript(
    ({ entitledValue, tokenValue }) => {
      window.localStorage.setItem(
        'pocketbase_auth',
        JSON.stringify({
          token: tokenValue,
          record: {
            id: 'e2e-mobile-user',
            email: 'atlas-mobile-e2e@example.com',
            entitled: entitledValue,
          },
        }),
      )
      // Signing in flips `alreadyEntered`, which would otherwise surface the
      // first-run OnboardingFlow overlay and block every click these tests
      // make -- this suite isn't testing onboarding, so mark it done upfront.
      window.localStorage.setItem('atlas-onboarding-flow-complete', '1')
    },
    { entitledValue: entitled, tokenValue: E2E_TOKEN },
  )
}

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

test('mobile signed-out user lands on visible-tonight feed before signup', async ({ page }) => {
  await page.goto('/app/today')

  await expect(page.getByRole('heading', { name: /Tonight is live|Hold for a better window/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.account-form')).toHaveCount(0)
  await expect(page.locator('.dt-equipment-prompt')).toHaveCount(0)

  const target = page.locator('.dt-feed-row').first()
  await expect(target).toBeVisible()
  await expect(target).toContainText('Full Moon')
  await expect(target).toContainText(/naked-eye|needs binoculars or a scope/)
  await target.click()

  const preview = page.locator('.dt-feed-preview').first()
  await expect(preview).toBeVisible()
  await expect(preview.getByText('You would see the Moon clearly, with shape, shadow, or surface detail visible by eye.')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const taps = JSON.parse(window.localStorage.getItem('atlas-first-plan-target-taps') ?? '[]')
        return taps[0]
      }),
    )
    .toMatchObject({
      targetId: 'e2e-mobile-activation-moon',
      title: 'Full Moon',
      kind: 'moon_phase',
      source: 'mobile_hub',
      locationLabel: 'Melbourne',
    })
})

test('mobile equipment prompt waits for first target tap and saves gear choice', async ({ page }) => {
  await page.goto('/app/today')

  await expect(page.getByRole('heading', { name: /Tonight is live|Hold for a better window/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.dt-equipment-prompt')).toHaveCount(0)

  await page.locator('.dt-feed-row').first().click()
  const prompt = page.locator('.dt-equipment-prompt')
  await expect(prompt).toBeVisible()
  await prompt.getByRole('button', { name: 'My phone' }).click()

  await expect(prompt).toHaveCount(0)
  await expect(page.evaluate(() => window.localStorage.getItem('atlas-first-plan-equipment'))).resolves.toBe('phone')
  await expect(page.evaluate(() => window.localStorage.getItem('atlas-first-plan-equipment-dismissed'))).resolves.toBe('1')
  await expect(page.getByText('Good match for a phone camera.')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: /Tonight is live|Hold for a better window/ })).toBeVisible({ timeout: 15_000 })
  await page.locator('.dt-feed-row').first().click()
  await expect(page.locator('.dt-equipment-prompt')).toHaveCount(0)
  await expect(page.getByText('Good match for a phone camera.')).toBeVisible()
})

test('mobile signed-out user must sign in before using Plan', async ({ page }) => {
  await page.goto('/app/today')

  await expect(page.getByRole('heading', { name: /Tonight is live|Hold for a better window/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/Bortle \d/).first()).toBeVisible()
  await page.getByRole('button', { name: 'Plan', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Unlock Planning with Sky Pass' })).toBeVisible()
  await expect(page.getByText('Discounted users still need to complete Polar checkout first.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in / create account' })).toBeVisible()
  await expect(page.getByLabel('Plan sections')).toHaveCount(0)

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByPlaceholder(/Search events/).fill('moon')
  await page.getByRole('button', { name: 'Watch' }).first().click()

  await expect(page.getByText('Sky Pass is required to add targets to a plan. Browsing and check-ins stay free.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Unlock Add to plan with Sky Pass' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in / create account' })).toBeVisible()
  await expect(page.locator('.account-form')).toHaveCount(0)
})

test('mobile signed-in free user must checkout before using Plan', async ({ page }) => {
  await seedSignedInUser(page, false)
  await page.goto('/app/today')

  await expect(page.getByRole('heading', { name: /Tonight is live|Hold for a better window/ })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Plan', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Unlock Planning with Sky Pass' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Get the Sky Pass' })).toBeVisible()
  await expect(page.getByLabel('Plan sections')).toHaveCount(0)
})

test('mobile entitled user can compare lower light pollution sites and routes', async ({ page }) => {
  await seedSignedInUser(page, true)
  await page.goto('/app/today')

  await expect(page.getByRole('heading', { name: /Tonight is live|Hold for a better window/ })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Plan', exact: true }).click()
  await page.getByRole('button', { name: /Dark sites/i }).click()

  await expect(page.getByText(/Sky near .* right now/)).toBeVisible()
  await expect(page.getByText(/NOTICEABLY DARKER THAN HOME|BEST KNOWN MATCH/).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Apple' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Google' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open Transit Route' }).first()).toHaveAttribute('href', /mode=transit|travelmode=transit/)
})

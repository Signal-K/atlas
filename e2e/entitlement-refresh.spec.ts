import { expect, test, type Page } from '@playwright/test'

const PB_URL = process.env.VITE_PB_URL || 'http://localhost:8094'
const APP_URL = `http://localhost:${process.env.PLAYWRIGHT_PORT || '5173'}`
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
            id: 'e2e-user',
            email: 'atlas-entitlement-e2e@example.com',
            entitled: entitledValue,
          },
        }),
      )
    },
    { entitledValue: entitled, tokenValue: E2E_TOKEN },
  )
}

async function mockPlanEvent(page: Page) {
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
            id: 'e2e-entitlement-plan-event',
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

test('refreshes Sky Pass access after webhook-updated entitlement', async ({ page }) => {
  await seedSignedInUser(page, false)

  await page.route(`${PB_URL}/api/collections/users/auth-refresh`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: E2E_TOKEN,
        record: {
          id: 'e2e-user',
          email: 'atlas-entitlement-e2e@example.com',
          entitled: true,
        },
      }),
    })
  })

  await page.goto('/settings')

  await expect(page.getByText('Sky Pass active')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Plan a trip' }).click()
  await expect(page.getByRole('tab', { name: 'Event plan' })).toBeVisible()
  await expect(page.getByText('Planning is part of the Sky Pass')).toHaveCount(0)
})

test('desktop settings uses grouped account layout without duplicate headings', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await seedSignedInUser(page, true)

  await page.route(`${PB_URL}/api/collections/users/auth-refresh`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: E2E_TOKEN,
        record: {
          id: 'e2e-user',
          email: 'atlas-entitlement-e2e@example.com',
          entitled: true,
        },
      }),
    })
  })

  await page.goto('/settings')

  await expect(page.locator('.settings-group[data-group="account"]')).toBeVisible()
  await expect(page.locator('.settings-account-email')).toHaveText('atlas-entitlement-e2e@example.com')
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toHaveCount(0)
  await expect(page.getByText('Sky Pass active')).toHaveClass(/settings-status--pill/)
})

test('falls back when dynamic Polar checkout creation fails', async ({ page }) => {
  await seedSignedInUser(page, false)

  await page.route(`${PB_URL}/api/collections/users/auth-refresh`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: E2E_TOKEN,
        record: {
          id: 'e2e-user',
          email: 'atlas-entitlement-e2e@example.com',
          entitled: false,
        },
      }),
    })
  })
  await page.route(`${PB_URL}/checkout/polar`, async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'checkout unavailable' }) })
  })
  await mockPlanEvent(page)

  await page.goto('/plan')
  await expect(page.getByText('Planning is part of the Sky Pass')).toBeVisible()
  await page.getByRole('button', { name: 'Get the Sky Pass' }).click()

  await expect(page).toHaveURL(`${APP_URL}/fallback-checkout`)
})

test('settings Sky Pass CTA uses dynamic checkout and falls back when unavailable', async ({ page }) => {
  await seedSignedInUser(page, false)

  await page.route(`${PB_URL}/api/collections/users/auth-refresh`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: E2E_TOKEN,
        record: {
          id: 'e2e-user',
          email: 'atlas-entitlement-e2e@example.com',
          entitled: false,
        },
      }),
    })
  })
  await page.route(`${PB_URL}/checkout/polar`, async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'checkout unavailable' }) })
  })

  await page.goto('/settings')
  await page.getByRole('button', { name: 'Get the Sky Pass' }).click()

  await expect(page).toHaveURL(`${APP_URL}/fallback-checkout`)
})

import { expect, test, type Page } from '@playwright/test'

const PB_URL = process.env.VITE_PB_URL || 'http://localhost:8094'
const BILLING_URL = process.env.VITE_ATLAS_BILLING_URL || 'http://127.0.0.1:8093'
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
      // Signing in flips `alreadyEntered`, which would otherwise surface the
      // first-run OnboardingFlow overlay and block every click these tests
      // make -- this suite isn't testing onboarding, so mark it done upfront.
      window.localStorage.setItem('atlas-onboarding-flow-complete', '1')
    },
    { entitledValue: entitled, tokenValue: E2E_TOKEN },
  )
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

  await page.goto('/app/settings')

  await page.getByRole('tab', { name: 'Account' }).click()
  await expect(page.locator('.settings-status--pill', { hasText: 'Sky Pass active' })).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('#primary-navigation').getByRole('link', { name: 'Plan', exact: true })).toBeVisible()
})

test('trusts a paid reconciliation result when auth-refresh returns a stale entitlement field', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await seedSignedInUser(page, false)

  await page.route(`${BILLING_URL}/entitlement/polar/refresh`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ entitled: true }),
    })
  })
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
  await page.goto('/app/settings')

  await page.getByRole('tab', { name: 'Account' }).click()
  await expect(page.locator('.settings-account-email')).toHaveText('atlas-entitlement-e2e@example.com', { timeout: 10_000 })
  await expect(page.locator('.settings-status--pill', { hasText: 'Sky Pass active' })).toBeVisible()
})

test('desktop settings shows one page heading and grouped account status', async ({ page }) => {
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

  await page.goto('/app/settings')

  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toHaveCount(1)
  await page.getByRole('tab', { name: 'Account' }).click()
  await expect(page.locator('.settings-detail').filter({ has: page.getByRole('heading', { name: 'Account', exact: true }) })).toBeVisible()
  await expect(page.locator('.settings-account-email')).toHaveText('atlas-entitlement-e2e@example.com')
  await expect(page.locator('.settings-status--pill', { hasText: 'Sky Pass active' })).toHaveClass(/settings-status--pill/)
})

test('falls back when dynamic Polar checkout creation fails', async ({ page }) => {
  await seedSignedInUser(page, false)

  await page.route(`${BILLING_URL}/entitlement/polar/refresh`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ entitled: false }),
    })
  })
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
  await page.goto('/app/settings')
  await page.getByRole('tab', { name: 'Account' }).click()
  await expect(page.getByRole('button', { name: 'Already paid? Check purchase' })).toBeVisible()
  await page.getByRole('button', { name: 'Get the Sky Pass' }).click()

  await expect(page).toHaveURL(`${APP_URL}/fallback-checkout`)
})

test('settings Sky Pass CTA uses dynamic checkout and falls back when unavailable', async ({ page }) => {
  await seedSignedInUser(page, false)

  await page.route(`${BILLING_URL}/entitlement/polar/refresh`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ entitled: false }),
    })
  })
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

  await page.goto('/app/settings')
  await page.getByRole('tab', { name: 'Account' }).click()
  await page.getByRole('button', { name: 'Get the Sky Pass' }).click()

  await expect(page).toHaveURL(`${APP_URL}/fallback-checkout`)
})

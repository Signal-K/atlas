import { expect, test, type Page } from '@playwright/test'
import { ONBOARDING_VERSION } from '../src/lib/onboarding'
import { resolvePbUrl } from './support/pbUrl'

const PB_URL = resolvePbUrl()
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
    ({ entitledValue, tokenValue, versionValue }) => {
      window.localStorage.setItem(
        'pocketbase_auth',
        JSON.stringify({
          token: tokenValue,
          record: {
            id: 'e2e-user',
            email: 'atlas-entitlement-e2e@example.com',
            entitled: entitledValue,
            // Both gate inputs, so the seeded account doesn't read as a
            // brand-new signup to the account-side half of the check.
            onboarded: true,
            onboarding_version: versionValue,
          },
        }),
      )
      // Signing in flips `alreadyEntered`, which would otherwise surface the
      // first-run OnboardingFlow overlay and block every click these tests
      // make -- this suite isn't testing onboarding, so mark it done upfront.
      // The flag holds a *version* (lib/onboarding.ts), not a boolean, so it
      // has to be seeded from the constant rather than a hardcoded '1' -- a
      // stale literal would silently put these tests back inside the flow.
      window.localStorage.setItem('atlas-onboarding-flow-complete', String(versionValue))
    },
    { entitledValue: entitled, tokenValue: E2E_TOKEN, versionValue: ONBOARDING_VERSION },
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

  await page.getByRole('button', { name: /^Account/ }).click()
  await expect(page.locator('.settings-status--pill', { hasText: 'Sky Pass active' })).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('#primary-navigation').getByRole('link', { name: 'Planner', exact: true })).toBeVisible()
})

test('trusts a paid reconciliation result when auth-refresh returns a stale entitlement field', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await seedSignedInUser(page, true)

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

  await page.getByRole('button', { name: /^Account/ }).click()
  await expect(page.locator('.settings-account-email')).toHaveText('atlas-entitlement-e2e@example.com', { timeout: 10_000 })
  await expect(page.locator('.settings-status--pill', { hasText: 'Sky Pass active' })).toBeVisible()
})

test('a routine free session refreshes PocketBase without calling atlas-billing', async ({ page }) => {
  await seedSignedInUser(page, false)
  let billingRequests = 0

  await page.route(`${BILLING_URL}/entitlement/polar/refresh`, async (route) => {
    billingRequests += 1
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'should not reconcile' }) })
  })
  await page.route(`${PB_URL}/api/collections/users/auth-refresh`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: E2E_TOKEN, record: { id: 'e2e-user', email: 'atlas-entitlement-e2e@example.com', entitled: false } }),
    })
  })

  await page.goto('/app/settings')
  await page.getByRole('button', { name: /^Account/ }).click()
  await expect(page.locator('.settings-account-email')).toHaveText('atlas-entitlement-e2e@example.com')
  expect(billingRequests).toBe(0)
})

test('a post-checkout return reconciles even before the cached account is entitled', async ({ page }) => {
  await seedSignedInUser(page, false)
  let billingRequests = 0

  await page.route(`${BILLING_URL}/entitlement/polar/refresh`, async (route) => {
    billingRequests += 1
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entitled: true }) })
  })
  await page.route(`${PB_URL}/api/collections/users/auth-refresh`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: E2E_TOKEN, record: { id: 'e2e-user', email: 'atlas-entitlement-e2e@example.com', entitled: false } }),
    })
  })

  // Use the canonical profile route. The legacy Settings alias redirects,
  // which is unrelated to processing Polar's checkout return.
  await page.goto('/app/profile?checkout=returned')
  await page.getByRole('button', { name: /^Account/ }).click()
  await expect(page.locator('.settings-status--pill', { hasText: 'Sky Pass active' })).toBeVisible()
  expect(billingRequests).toBeGreaterThan(0)
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

  await expect(page.getByRole('heading', { name: 'You', exact: true })).toHaveCount(1)
  await page.getByRole('button', { name: /^Account/ }).click()
  await expect(page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible()
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
  await page.getByRole('button', { name: /^Account/ }).click()
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
  await page.getByRole('button', { name: /^Account/ }).click()
  await page.getByRole('button', { name: 'Get the Sky Pass' }).click()

  await expect(page).toHaveURL(`${APP_URL}/fallback-checkout`)
})

// ASV-113: a failing billing endpoint must not be retried on every reload. The
// backoff is persisted, so a "reload" (new page load) inside the cooldown
// makes no further call.
test('a failed entitlement reconcile is not retried after a reload inside the cooldown', async ({ page }) => {
  let calls = 0
  await seedSignedInUser(page, true)
  await page.route(`${BILLING_URL}/entitlement/polar/refresh`, async (route) => {
    calls += 1
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
  })
  await page.route(`${PB_URL}/api/collections/users/auth-refresh`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: E2E_TOKEN, record: { id: 'e2e-user', email: 'atlas-entitlement-e2e@example.com', entitled: true } }),
    })
  })
  await page.goto('/app/profile')
  await expect.poll(() => calls).toBe(1)

  await page.reload()
  await page.waitForTimeout(1500)
  expect(calls, 'reload within the cooldown must not call billing again').toBe(1)
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('atlas-entitlement-reconcile') ?? 'null'))
  expect(state?.failures).toBe(1)
})

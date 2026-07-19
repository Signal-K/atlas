import { expect, test, type Page } from '@playwright/test'

const PB_URL = process.env.VITE_PB_URL || 'http://localhost:8094'
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
  await expect(page.getByText('Planning is part of the Sky Pass')).toHaveCount(0)
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

  await page.goto('/plan')
  await expect(page.getByText('Planning is part of the Sky Pass')).toBeVisible()
  await page.getByRole('button', { name: 'Get the Sky Pass' }).click()

  await expect(page).toHaveURL('http://localhost:5173/fallback-checkout')
})

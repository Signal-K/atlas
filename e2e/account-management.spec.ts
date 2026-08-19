import { expect, test, type Page } from '@playwright/test'

const PB_URL = process.env.VITE_PB_URL || 'http://localhost:8094'
const E2E_USER_ID = 'e2e-account-mgmt-user'
const E2E_EMAIL = 'atlas-account-mgmt-e2e@example.com'
const E2E_TOKEN = makeAuthToken()

function makeAuthToken() {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    type: 'auth',
    collectionId: 'users',
  }
  return ['e2e', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'sig'].join('.')
}

function seedSignedInUser(page: Page) {
  return page.addInitScript(
    ({ tokenValue, userId, email }) => {
      window.localStorage.setItem(
        'pocketbase_auth',
        JSON.stringify({
          token: tokenValue,
          record: { id: userId, email, entitled: true },
        }),
      )
      // See entitlement-refresh.spec.ts -- this suite isn't testing
      // onboarding, so skip straight past the first-run overlay.
      window.localStorage.setItem('atlas-onboarding-flow-complete', '1')
    },
    { tokenValue: E2E_TOKEN, userId: E2E_USER_ID, email: E2E_EMAIL },
  )
}

async function mockAuthRefresh(page: Page, entitled = true) {
  await page.route(`${PB_URL}/api/collections/users/auth-refresh`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: E2E_TOKEN,
        record: { id: E2E_USER_ID, email: E2E_EMAIL, entitled },
      }),
    })
  })
}

test.beforeEach(async ({ page }) => {
  await seedSignedInUser(page)
  await mockAuthRefresh(page)
  await page.goto('/app/settings')
  await page.getByRole('tab', { name: 'Account' }).click()
  await expect(page.locator('.settings-account-email')).toHaveText(E2E_EMAIL)
})

// Password and email are managed through Clerk's own account portal since
// KES-189 (see AccountManagement.tsx) -- there's no in-app form left to
// drive here, just a button that opens Clerk's UI, which isn't something
// worth asserting on in this suite (it's Clerk's own, already-tested UI).
test('opens Clerk\'s account portal for password/email management', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Manage password & email' })).toBeVisible()
})

test('delete account stays disabled until the account email is typed exactly, then signs the user out', async ({ page }) => {
  await page.route(`${PB_URL}/api/collections/users/records/${E2E_USER_ID}`, async (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback()
    await route.fulfill({ status: 204, contentType: 'application/json', body: '' })
  })

  await page.getByRole('button', { name: 'Delete account' }).click()
  const confirmInput = page.getByPlaceholder(E2E_EMAIL)
  const deleteButton = page.getByRole('button', { name: 'Permanently delete account' })

  await expect(deleteButton).toBeDisabled()
  await confirmInput.fill('not the right email')
  await expect(deleteButton).toBeDisabled()

  await confirmInput.fill(E2E_EMAIL)
  await expect(deleteButton).toBeEnabled()
  await deleteButton.click()

  // deleteAccount() clears pb.authStore, and the app's auth listener drops
  // back to the signed-out sign-in form on its own -- no manual navigation.
  // AuthForm's own submit affordance is now Clerk's "Continue" button, not a
  // "Sign in" button, so it's the "Sign in" tab (still ours) that proves
  // this landed back on the signed-out form.
  await expect(page.getByRole('tab', { name: 'Sign in', exact: true })).toBeVisible()
})

test('delete account can be cancelled without deleting anything', async ({ page }) => {
  let deleteCalled = false
  await page.route(`${PB_URL}/api/collections/users/records/${E2E_USER_ID}`, async (route) => {
    if (route.request().method() === 'DELETE') deleteCalled = true
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  })

  await page.getByRole('button', { name: 'Delete account' }).click()
  await page.getByPlaceholder(E2E_EMAIL).fill(E2E_EMAIL)
  await expect(page.getByRole('button', { name: 'Permanently delete account' })).toBeEnabled()

  await page.getByRole('button', { name: 'Cancel' }).click()

  await expect(page.getByRole('button', { name: 'Permanently delete account' })).toHaveCount(0)
  await expect(page.locator('.settings-account-email')).toHaveText(E2E_EMAIL)
  expect(deleteCalled).toBe(false)
})

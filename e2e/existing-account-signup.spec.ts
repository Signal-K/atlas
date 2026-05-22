import { expect, test } from '@playwright/test'
import { setupClerkTestingToken } from '@clerk/testing/playwright'
import { clerkTestEmail, deleteClerkTestUser, fillClerkSignUp } from './support/clerk'

const PB_URL = process.env.VITE_PB_URL || 'http://localhost:8094'

// Covers the email-fallback matching in backend/clerk_exchange.go: an
// account created before this person ever went through Clerk (no
// clerk_user_id set yet) has to link to their first Clerk sign-in rather
// than getting a second, duplicate `users` record with the same email.
test('an existing PocketBase account links to Clerk on first sign-in instead of duplicating', async ({ page, request }) => {
  const email = clerkTestEmail('existing-account')
  const legacyPassword = `Legacy-e2e-${Date.now()}!`

  const createResponse = await request.post(`${PB_URL}/api/collections/users/records`, {
    data: { email, password: legacyPassword, passwordConfirm: legacyPassword },
  })
  expect(createResponse.ok(), await createResponse.text()).toBe(true)
  const legacyRecord = (await createResponse.json()) as { id: string }

  try {
    await setupClerkTestingToken({ page })
    await page.goto('/app/settings')
    await page.getByRole('tab', { name: 'Create account' }).click()
    await expect(page.getByRole('button', { name: /Google|Apple/i })).toHaveCount(0)
    await fillClerkSignUp(page, email, 'Different-clerk-password!1')

    // Clerk's own "Verify your email" step also renders the email as plain
    // text, so `getByText(email)` alone would pass before the exchange ever
    // runs -- `.settings-account-email` is Settings' own post-exchange
    // element, not present until AuthForm has actually handed off to it.
    await expect(page.locator('.settings-account-email')).toHaveText(email, { timeout: 15_000 })
    await expect(page.locator('.account-form-error')).toHaveCount(0)

    const linkedId = await page.evaluate(() => {
      const raw = window.localStorage.getItem('pocketbase_auth')
      return raw ? (JSON.parse(raw) as { record: { id: string } }).record.id : null
    })
    expect(linkedId, 'exchange should attach to the pre-existing record by email, not create a new one').toBe(legacyRecord.id)
  } finally {
    await deleteClerkTestUser({ email })
  }
})

import { expect, test } from '@playwright/test'

const PB_URL = process.env.VITE_PB_URL || 'http://localhost:8094'

test('signup with an existing ecosystem account logs in when the password matches', async ({ page }) => {
  const authToken = ['e2e', Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'sig'].join('.')
  const record = {
    id: 'e2e-shared-ecosystem-user',
    email: 'shared-account@example.com',
    entitled: true,
    collectionId: 'users',
    collectionName: 'users',
  }
  let createAttempted = false
  let loginAttempted = false

  await page.route(`${PB_URL}/api/collections/users/records`, async (route) => {
    createAttempted = true
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Failed to create record.',
        data: {
          email: {
            code: 'validation_not_unique',
            message: 'The email is invalid or already in use.',
          },
        },
      }),
    })
  })
  await page.route(`${PB_URL}/api/collections/users/auth-with-password`, async (route) => {
    loginAttempted = true
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: authToken, record }),
    })
  })
  await page.route(`${PB_URL}/api/collections/users/auth-refresh`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: authToken, record }),
    })
  })

  await page.goto('/settings')
  await page.getByRole('button', { name: 'Need an account?' }).click()
  await page.getByPlaceholder('Email').fill(record.email)
  await page.getByPlaceholder('Password').fill('same-ecosystem-password')
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect.poll(() => createAttempted).toBe(true)
  await expect.poll(() => loginAttempted).toBe(true)
  await expect(page.getByText(record.email)).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.settings-status--pill', { hasText: 'Sky Pass active' })).toBeVisible()
  await expect(page.locator('.account-form-error')).toHaveCount(0)
})

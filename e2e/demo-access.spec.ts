import { expect, test } from '@playwright/test'

const PB_URL = process.env.VITE_PB_URL || 'http://localhost:8094'

test('demo access link grants Sky Pass after signup without checkout', async ({ page }) => {
  const authToken = ['e2e', Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'sig'].join('.')
  const signedUpRecord = {
    id: 'e2e-demo-access-user',
    email: 'demo-access-e2e@example.com',
    entitled: false,
  }
  const entitledRecord = {
    ...signedUpRecord,
    entitled: true,
  }
  let redeemedCode: string | null = null

  await page.route(`${PB_URL}/api/collections/users/records`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(signedUpRecord),
    })
  })
  await page.route(`${PB_URL}/api/collections/users/auth-with-password`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: authToken, record: signedUpRecord }),
    })
  })
  await page.route(`${PB_URL}/atlas/demo-access/redeem`, async (route) => {
    const body = route.request().postDataJSON() as { code?: string }
    redeemedCode = body.code ?? null
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, entitled: true }),
    })
  })
  await page.route(`${PB_URL}/api/collections/users/auth-refresh`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: authToken, record: entitledRecord }),
    })
  })

  await page.goto('/app/settings?demo=demo-floor')
  await page.getByRole('button', { name: 'Need an account?' }).click()
  await page.getByPlaceholder('Email').fill(signedUpRecord.email)
  await page.getByPlaceholder('Password').fill('password123')
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect.poll(() => redeemedCode).toBe('demo-floor')
  await expect(page.locator('.settings-status--pill', { hasText: 'Sky Pass active' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: 'Get the Sky Pass' })).toHaveCount(0)
  await expect(page.evaluate(() => window.localStorage.getItem('atlas-demo-access-code'))).resolves.toBeNull()
})

import { expect, test } from '@playwright/test'
import { setupClerkTestingToken } from '@clerk/testing/playwright'
import { clerkTestEmail, deleteClerkTestUser, fillClerkSignUp } from './support/clerk'

const PB_URL = process.env.VITE_PB_URL || 'http://localhost:8094'

test('demo access link grants Sky Pass after signup without checkout', async ({ page }) => {
  const email = clerkTestEmail('demo-access')
  const password = 'Atlas-e2e-demo-access!1'
  let redeemedCode: string | null = null

  // The demo redeem endpoint is unrelated business logic (see
  // src/lib/demoAccess.ts) -- mocking it keeps this test about "does a
  // successful Clerk sign-up trigger the redeem call", not about whether a
  // "demo-floor" code happens to be configured on whatever backend the e2e
  // run points at. /auth/clerk-exchange itself is NOT mocked -- it hits the
  // real backend, same as AuthForm does in production.
  await page.route(`${PB_URL}/atlas/demo-access/redeem`, async (route) => {
    const body = route.request().postDataJSON() as { code?: string }
    redeemedCode = body.code ?? null
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, entitled: true }),
    })
  })
  // redeemStoredDemoAccessCode() calls authRefresh() right after redeeming
  // (see src/lib/demoAccess.ts) to pick up the flipped `entitled` flag --
  // stubbed here since the real backend's demo-access hook, not part of the
  // Clerk migration, is what would normally flip it server-side.
  await page.route(`${PB_URL}/api/collections/users/auth-refresh`, async (route) => {
    const authToken = ['e2e', Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'sig'].join('.')
    const current = await page.evaluate(() => {
      const raw = window.localStorage.getItem('pocketbase_auth')
      return raw ? (JSON.parse(raw) as { record: Record<string, unknown> }).record : null
    })
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: authToken, record: { ...current, entitled: true } }),
    })
  })

  await setupClerkTestingToken({ page })

  try {
    await page.goto('/app/settings?demo=demo-floor')
    await page.getByRole('tab', { name: 'Create account' }).click()
    await fillClerkSignUp(page, email, password)

    await expect.poll(() => redeemedCode).toBe('demo-floor')
    await expect(page.locator('.az-pill', { hasText: 'SKY PASS · ACTIVE' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: /Get Sky Pass/ })).toHaveCount(0)
    await expect(page.evaluate(() => window.localStorage.getItem('atlas-demo-access-code'))).resolves.toBeNull()
  } finally {
    await deleteClerkTestUser({ email })
  }
})

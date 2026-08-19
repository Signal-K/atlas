import { expect, test } from '@playwright/test'
import { setupClerkTestingToken } from '@clerk/testing/playwright'
import { clerkTestEmail, deleteClerkTestUser, fillClerkSignUp, readPocketBaseAuth } from './support/clerk'

test.describe('PocketBase-backed write actions', () => {
  test.skip(!process.env.E2E_WRITE_TESTS, 'Requires a local PocketBase backend with Atlas collections')

  test('signs up and writes an observation to local PocketBase', async ({ page, request }) => {
    const pbUrl = process.env.VITE_PB_URL || 'http://localhost:8094'
    const email = clerkTestEmail('write-actions')
    const password = `Atlas-e2e-${Date.now()}!`
    const note = `PocketBase write smoke ${Date.now()}`

    await setupClerkTestingToken({ page })

    try {
      // Signing up flips `alreadyEntered`, which would otherwise surface the
      // first-run OnboardingFlow overlay and block the Scrapbook tab click
      // below -- this test isn't testing onboarding, so mark it done upfront.
      await page.addInitScript(() => window.localStorage.setItem('atlas-onboarding-flow-complete', '1'))
      await page.goto('/app/settings')

      await page.getByRole('tab', { name: 'Create account' }).click()
      await fillClerkSignUp(page, email, password)
      // Settings intentionally opens on Location. Account remains available
      // as a tab after sign-up without taking over the initial screen.
      await page.getByRole('tab', { name: 'Account' }).click()
      // Clerk's own "Verify your email" step also renders the email as
      // plain text, so `getByText(email)` alone would pass before the
      // exchange has actually run -- wait for Settings' own post-exchange
      // element instead.
      await expect(page.locator('.settings-account-email')).toHaveText(email, { timeout: 15_000 })

      const auth = await readPocketBaseAuth(page)
      if (!auth) throw new Error('Expected pb.authStore to hold a token after the Clerk exchange completed.')

      await page.goto('/app/journal')
      await page.getByRole('tab', { name: 'Private' }).click()
      await page.locator('textarea').fill(note)
      await page.getByRole('button', { name: 'Save observation' }).click()
      await expect(page.getByText(note)).toBeVisible({ timeout: 10_000 })

      // The push to PocketBase is a best-effort, fire-and-forget background
      // sync (see pushObservation in src/lib/sync.ts) that isn't awaited by
      // the Save button before the local "note visible" state above -- so the
      // remote row can land a beat after the UI already shows it locally.
      // Poll instead of a single-shot read.
      let records: Awaited<ReturnType<typeof getObservationRecords>> = { items: [] }
      await expect
        .poll(async () => {
          records = await getObservationRecords(request, pbUrl, auth.token, auth.record.id, note)
          return records.items.length
        }, `Expected a remote atlas_observations row for note "${note}"`)
        .toBe(1)
      expect(records.items[0].note).toBe(note)
    } finally {
      await deleteClerkTestUser({ email })
    }
  })
})

async function getObservationRecords(request: import('@playwright/test').APIRequestContext, pbUrl: string, token: string, userId: string, note: string) {
  const url = new URL(`${pbUrl}/api/collections/atlas_observations/records`)
  url.searchParams.set('filter', `user = "${userId}" && note = "${note}"`)
  const response = await request.get(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(response.ok(), await response.text()).toBe(true)
  return (await response.json()) as { items: Array<{ id: string; note: string }> }
}

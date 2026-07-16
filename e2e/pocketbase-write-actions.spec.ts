import { expect, test, type APIRequestContext } from '@playwright/test'

test.describe('PocketBase-backed write actions', () => {
  test.skip(!process.env.E2E_WRITE_TESTS, 'Requires a local PocketBase backend with Atlas collections')

  test('signs up and writes an observation to local PocketBase', async ({ page, request }) => {
    const pbUrl = process.env.VITE_PB_URL || 'http://localhost:8094'
    const stamp = Date.now()
    const email = `atlas-e2e-${stamp}@example.com`
    const password = `Atlas-e2e-${stamp}!`
    const note = `PocketBase write smoke ${stamp}`

    await page.goto('/settings')

    await page.getByRole('button', { name: 'Need an account?' }).click()
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill(password)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText(email)).toBeVisible({ timeout: 10_000 })

    await page.goto('/history')
    await page.getByRole('tab', { name: 'Scrapbook' }).click()
    await page.locator('textarea').fill(note)
    await page.getByRole('button', { name: 'Save observation' }).click()
    await expect(page.getByText(note)).toBeVisible({ timeout: 10_000 })

    const auth = await authenticate(request, pbUrl, email, password)
    const records = await getObservationRecords(request, pbUrl, auth.token, auth.record.id, note)

    expect(records.items, `Expected a remote atlas_observations row for note "${note}"`).toHaveLength(1)
    expect(records.items[0].note).toBe(note)
  })
})

async function authenticate(request: APIRequestContext, pbUrl: string, identity: string, password: string) {
  const response = await request.post(`${pbUrl}/api/collections/users/auth-with-password`, {
    data: { identity, password },
  })
  expect(response.ok(), await response.text()).toBe(true)
  return (await response.json()) as { token: string; record: { id: string } }
}

async function getObservationRecords(request: APIRequestContext, pbUrl: string, token: string, userId: string, note: string) {
  const url = new URL(`${pbUrl}/api/collections/atlas_observations/records`)
  url.searchParams.set('filter', `user = "${userId}" && note = "${note}"`)
  const response = await request.get(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(response.ok(), await response.text()).toBe(true)
  return (await response.json()) as { items: Array<{ id: string; note: string }> }
}

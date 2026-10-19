import { expect, test } from '@playwright/test'
import { seedSignedInUser } from './support/auth'
import { resolvePbUrl } from './support/pbUrl'

const PB_URL = resolvePbUrl()

// ASV-111: first-run journal showed a "Your entries" header over nothing, and
// an entry with no named target was titled just "Observation" with a "NOTE" tile.

async function mockObservations(page: import('@playwright/test').Page, items: unknown[]) {
  await page.route(`${PB_URL}/api/collections/atlas_observations/records**`, (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ page: 1, perPage: 500, totalItems: items.length, totalPages: 1, items }),
  }))
}

test('an empty journal does not show an empty "Your entries" header', async ({ page }) => {
  await seedSignedInUser(page, { id: 'journal-empty-user' })
  await mockObservations(page, [])
  await page.goto('/app/journal')

  await expect(page.getByRole('heading', { name: /Keep a record of the sky/ })).toBeVisible()
  await expect(page.getByText('Your entries', { exact: true })).toHaveCount(0)
})

test('an entry without a named target is titled from its place, not "Observation"', async ({ page }) => {
  await seedSignedInUser(page, { id: 'journal-untitled-user' })
  await mockObservations(page, [{
    id: 'untitled-entry',
    collectionId: 'atlas_observations',
    collectionName: 'atlas_observations',
    user: 'journal-untitled-user',
    observed_at: '2026-08-12 18:24:19.000Z',
    location_label: 'Perth, Western Australia, Australia',
    note: 'Clear and dark.',
  }])
  await page.goto('/app/journal')

  const row = page.locator('.az-row').filter({ hasText: 'Clear and dark.' })
  await expect(row.locator('.az-row-title')).toHaveText('Sky session · Perth')
  await expect(page.getByText('Your entries', { exact: true })).toBeVisible()
  await expect(row.locator('.az-thumb')).not.toHaveText('NOTE')
  await expect(row.locator('.az-thumb svg')).toHaveCount(1)
})

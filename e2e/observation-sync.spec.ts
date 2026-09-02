import { expect, test } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

const PB_URL = process.env.VITE_PB_URL || 'http://localhost:8094'

test('Journal hydrates private PocketBase observations in a fresh browser', async ({ page }) => {
  await seedSignedInUser(page, { id: 'remote-observation-user', entitled: true })

  await page.route(`${PB_URL}/api/collections/atlas_observations/records**`, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        page: 1,
        perPage: 500,
        totalItems: 2,
        totalPages: 1,
        items: [
          {
            id: 'remote-eclipse-observation',
            collectionId: 'atlas_observations',
            collectionName: 'atlas_observations',
            user: 'remote-observation-user',
            event: 'total-solar-eclipse',
            observed_at: '2026-08-12 18:24:19.000Z',
            target_name: 'Total Solar Eclipse',
            device_used: 'Apple iPhone 16',
            camera_recipe_used: '26 mm equivalent, f/1.6, 1/3448 s',
            attempt_rating: 'great',
            note: 'Imported eclipse observation from another device.',
            photo: 'eclipse-one.png',
          },
          {
            id: 'remote-eclipse-observation-2',
            collectionId: 'atlas_observations',
            collectionName: 'atlas_observations',
            user: 'remote-observation-user',
            event: 'total-solar-eclipse',
            observed_at: '2026-08-12 18:25:12.000Z',
            target_name: 'Total Solar Eclipse',
            device_used: 'Nothing Phone (3a)',
            attempt_rating: 'great',
            note: 'Second eclipse photo in the same event thread.',
            photo: 'eclipse-two.png',
          },
        ],
      }),
    })
  })

  // A real image response exercises the authenticated private-file pull,
  // rather than only the observation metadata. This is deliberately a tiny
  // valid PNG: the Journal must never cache an HTML/error response as a photo.
  await page.route(`${PB_URL}/api/files/atlas_observations/remote-eclipse-observation/*.png`, async (route) => {
    await route.fulfill({
      contentType: 'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL3WQAAAABJRU5ErkJggg==', 'base64'),
    })
  })
  await page.route(`${PB_URL}/api/files/atlas_observations/remote-eclipse-observation-2/*.png`, async (route) => {
    await route.fulfill({
      contentType: 'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL3WQAAAABJRU5ErkJggg==', 'base64'),
    })
  })

  await page.goto('/app/journal')

  // The Journal redesign replaced the grouped "event thread" portfolio with
  // a flat Mine/Community entry list -- each PocketBase observation is its
  // own row, so hydration is verified per row rather than per thread.
  const rows = page.locator('.az-row').filter({ hasText: 'Total Solar Eclipse' })
  await expect(rows).toHaveCount(2)

  const firstRow = rows.filter({ hasText: 'Apple iPhone 16' })
  const secondRow = rows.filter({ hasText: 'Nothing Phone (3a)' })
  await expect(firstRow).toHaveCount(1)
  await expect(secondRow).toHaveCount(1)

  // A hydrated photo replaces the empty-thumb placeholder with a background
  // image; an unhydrated or failed pull would leave the "NOTE" placeholder.
  await expect(firstRow.locator('.az-thumb-empty')).toHaveCount(0)
  await expect(secondRow.locator('.az-thumb-empty')).toHaveCount(0)

  await firstRow.click()
  const detailSheet = page.getByRole('dialog', { name: 'Total Solar Eclipse' })
  await expect(detailSheet.getByText('Imported eclipse observation from another device.')).toBeVisible()
  await expect(detailSheet.getByText('Apple iPhone 16')).toBeVisible()
  await expect(detailSheet.getByRole('button', { name: /Share publicly/ })).toBeVisible()
})

import { expect, test } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

const PB_URL = process.env.VITE_PB_URL || 'http://localhost:8094'

test('Journal hydrates private PocketBase observations in a fresh browser', async ({ page }) => {
  await seedSignedInUser(page, { id: 'remote-observation-user' })

  await page.route(`${PB_URL}/api/collections/atlas_observations/records**`, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        page: 1,
        perPage: 500,
        totalItems: 1,
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
            photo: '',
          },
        ],
      }),
    })
  })

  await page.goto('/app/journal')

  await expect(page.getByText('Imported eclipse observation from another device.')).toBeVisible()
  await expect(page.getByText('Apple iPhone 16')).toBeVisible()
  await expect(page.getByText('Total Solar Eclipse')).toBeVisible()
})

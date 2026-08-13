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

  const eclipseThread = page.locator('.event-thread', { hasText: 'Total Solar Eclipse' })
  await expect(eclipseThread.getByText('Event thread')).toBeVisible()
  await expect(eclipseThread.getByText('2 posts')).toBeVisible()
  await expect(eclipseThread.getByRole('button', { name: /Open portfolio/ })).toBeVisible()

  const preview = eclipseThread.locator('.event-thread-preview').first()
  await expect(preview.locator('img')).toBeVisible()
  const previewBox = await preview.boundingBox()
  expect(previewBox?.width).toBeLessThanOrEqual(72)
  expect(previewBox?.height).toBeLessThanOrEqual(72)

  await eclipseThread.getByRole('button', { name: /Open portfolio/ }).click()
  await expect(eclipseThread.getByText('Imported eclipse observation from another device.')).toBeVisible()
  await expect(eclipseThread.getByText('Second eclipse photo in the same event thread.')).toBeVisible()
  await expect(eclipseThread.getByText('Apple iPhone 16')).toBeVisible()
  await expect(eclipseThread.locator('.event-thread-title')).toHaveText('Total Solar Eclipse')
  const shareButton = eclipseThread.getByRole('button', { name: 'Share this check-in' }).first()
  await expect(shareButton).toBeVisible()
  await shareButton.click()
  await expect(page.getByRole('heading', { name: 'A link to this post' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create share link' })).toBeVisible()
  await page.getByRole('button', { name: 'Close share dialog' }).click()

  await page.getByText('Check in for a past date').click()
  await expect(page.getByLabel('Date')).toBeVisible()
  await expect(page.getByLabel('Location')).toBeVisible()
  await expect(page.getByText(/date-only check-in/)).toBeVisible()
})

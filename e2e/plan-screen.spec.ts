import { test, expect, type Page } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

async function mockCloudyTonight(page: Page) {
  await page.route('https://api.open-meteo.com/**', async (route) => {
    const days = 7
    const today = new Date()
    const time = Array.from({ length: days }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      return d.toISOString().slice(0, 10)
    })

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        timezone: 'Europe/London',
        daily: {
          time,
          cloud_cover_mean: [82, 18, 40, 45, 50, 55, 60],
          // Tomorrow is clearer but rain-soaked; the recommendation should
          // choose the genuinely better following night instead.
          precipitation_probability_mean: [12, 90, 8, 10, 10, 12, 14],
        },
      }),
    })
  })
}

async function mockSkyEvents(page: Page) {
  await page.route('**/api/collections/sky_events/records**', async (route) => {
    const now = new Date()
    const startsAt = new Date(now.getTime() + 2 * 3_600_000)
    const endsAt = new Date(now.getTime() + 3 * 3_600_000)

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'e2e-plan-full-moon',
            kind: 'moon_phase',
            target: 'moon',
            title: 'Full Moon',
            description: 'The Moon reaches its fullest point tonight.',
            content: 'The Moon reaches its fullest point tonight.',
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            updated: now.toISOString(),
          },
        ],
        page: 1,
        perPage: 500,
        totalItems: 1,
        totalPages: 1,
      }),
    })
  })
}

async function openFullMoonEntry(page: Page) {
  await page.getByRole('button', { name: 'Full Moon' }).click()
  const equipmentPrompt = page.locator('.dt-equipment-prompt')
  if (await equipmentPrompt.isVisible().catch(() => false)) {
    await equipmentPrompt.locator('.dt-equipment-skip').click()
  }
  await expect(page.getByRole('heading', { name: 'Full Moon' })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await mockCloudyTonight(page)
  await mockSkyEvents(page)
  // "Get started" now requires an account before onboarding/the app shell
  // render at all (see AuthGate in App.tsx) -- this suite isn't testing
  // that gate or onboarding, so seed a signed-in, already-onboarded session
  // up front. Location moved from the landing page into OnboardingFlow's
  // own "location" step -- seed it directly, same as setManualLocation()
  // would.
  await seedSignedInUser(page)
  await page.addInitScript(() => {
    window.localStorage.setItem('atlas-manual-location', JSON.stringify({ name: 'London', lat: 51.5074, lon: -0.1278 }))
  })
  await page.goto('/app/dashboard')
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 15_000 })
})

test('opened entry detail has facts, best-time timeline, and weather sections', async ({ page }) => {
  await openFullMoonEntry(page)

  await expect(page.getByText('Camera suitability')).toBeVisible()
  await expect(page.getByText('Why look tonight')).toBeVisible()

  await expect(page.getByText('Best time tonight')).toBeVisible()
  await expect(page.locator('.dt-entry-timeline')).toBeVisible()
  await expect(page.getByText(/^Dusk /)).toBeVisible()
  await expect(page.getByText(/^Dawn /)).toBeVisible()

  await expect(page.getByText('Weather check')).toBeVisible()
  await expect(page.getByText('82% cloud cover forecast · 12% rain chance for the viewing window.')).toBeVisible()

  await expect(page.getByRole('button', { name: 'Camera recipe' })).toBeVisible()
  // Scoped to the entry detail's own button -- HubView's "After observing"
  // section renders a same-named button underneath.
  await expect(page.locator('.dt-entry').getByRole('button', { name: 'Log attempt' })).toBeVisible()
})

test('camera recipe is gated behind Sky Pass for a free account', async ({ page }) => {
  await openFullMoonEntry(page)

  await page.getByRole('button', { name: 'Camera recipe' }).click()

  await expect(page.getByRole('heading', { name: 'Unlock Deep camera setup with Sky Pass' })).toBeVisible()
  await expect(page.getByText('Your first walkthrough still includes the essential camera settings for free.')).toBeVisible()
  await expect(page.locator('.camera-recipe-facts')).toHaveCount(0)
})

test('camera recipe reveals device setup and a downloadable preset for an entitled account', async ({ page }) => {
  // Overrides the beforeEach's free (unentitled) seed -- addInitScript
  // stacks in call order, so re-navigating after this second call leaves
  // pocketbase_auth with entitled: true.
  await seedSignedInUser(page, { entitled: true })
  await page.goto('/app/dashboard')
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 15_000 })

  await openFullMoonEntry(page)
  await page.getByRole('button', { name: 'Camera recipe' }).click()

  await expect(page.getByRole('heading', { name: 'Unlock Deep camera setup with Sky Pass' })).toHaveCount(0)
  await expect(page.locator('.camera-recipe-facts').getByText('Mode', { exact: true })).toBeVisible()
  await expect(page.locator('.camera-recipe-facts').getByText('Lens', { exact: true })).toBeVisible()
  await expect(page.locator('.camera-recipe-facts').getByText('Exposure', { exact: true })).toBeVisible()
  await expect(page.locator('.camera-recipe-facts').getByText('Focus', { exact: true })).toBeVisible()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download Atlas preset' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^atlas-moon-.*\.atlas-preset\.json$/)
})

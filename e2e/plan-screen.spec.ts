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
  await page.goto('/app/tonight')
  await expect(page.getByRole('heading', { name: 'Tonight near London' })).toBeVisible({ timeout: 15_000 })
})

test('expanded first plan has time, direction, camera, and weather sections', async ({ page }) => {
  await page.locator('.tonight-target-main').first().click()

  const plan = page.locator('.tonight-target-plan').first()
  await expect(plan).toBeVisible()
  await expect(plan.locator('h4')).toHaveText(['Best time', 'Where to look', 'Camera preset', 'Weather check'])

  await expect(plan.locator('.best-time-timeline')).toBeVisible()
  await expect(plan.getByText(/is the best time to look tonight/)).toBeVisible()

  await expect(plan.locator('.sky-direction-compass')).toBeVisible()
  await expect(plan.getByText(/above the horizon/)).toBeVisible()

  await expect(plan.locator('.camera-preset-card')).toBeVisible()
  await expect(plan.locator('.camera-preset-card-facts dt').filter({ hasText: /^Mode$/ })).toBeVisible()
  await expect(plan.locator('.camera-preset-card-facts dt').filter({ hasText: /^Zoom$/ })).toBeVisible()
  await expect(plan.locator('.camera-preset-card-facts dt').filter({ hasText: /^Exposure$/ })).toBeVisible()
  await expect(plan.locator('.camera-preset-card-facts dt').filter({ hasText: /^Focus$/ })).toBeVisible()
  await expect(plan.getByText(/Tripod/)).toBeVisible()
  await expect(plan.getByRole('button', { name: 'Copy settings' })).toBeVisible()

  await expect(plan.getByText('82% cloud · 12% rain chance for the viewing window.')).toBeVisible()
  await expect(plan.getByText(/Clouded out tonight .* looks better \(40% cloud · 8% rain chance\)\./)).toBeVisible()
})

test('camera preset copy action writes the setup summary', async ({ page }) => {
  await page.evaluate(() => {
    let copiedText = ''
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          copiedText = value
        },
        readText: async () => copiedText,
      },
    })
  })

  await page.locator('.tonight-target-main').first().click()
  const plan = page.locator('.tonight-target-plan').first()
  await plan.getByRole('button', { name: 'Copy settings' }).click()

  await expect(plan.getByRole('button', { name: 'Copied!' })).toBeVisible()
  await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toContain('Mode:')
  await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toContain('Exposure:')
  await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toContain('Focus:')
  await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toContain('Stabilization:')
})

test('deep camera setup is premium while first-plan camera summary is free', async ({ page }) => {
  await page.locator('.tonight-target-main').first().click()
  const target = page.locator('.row-list > .tonight-target').first()

  await expect(target.locator('.camera-preset-card')).toBeVisible()
  await expect(target.getByText('Unlock Deep camera setup with Sky Pass')).toHaveCount(0)

  await target.getByRole('button', { name: 'Camera recipe' }).click()
  await expect(target.getByRole('heading', { name: 'Unlock Deep camera setup with Sky Pass' })).toBeVisible()
  await expect(target.getByText('Your first walkthrough still includes the essential camera settings for free.')).toBeVisible()
})

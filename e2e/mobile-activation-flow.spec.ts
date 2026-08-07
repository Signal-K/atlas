import { test, expect, type Page } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

async function mockTonightData(page: Page) {
  await page.route('https://api.open-meteo.com/**', async (route) => {
    const days = 7
    const today = new Date()
    const time = Array.from({ length: days }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      return d.toISOString().slice(0, 10)
    })
    const nightlyCloud = [5, 65, 90, 24, 58, 46, 76]
    const nightlyRain = [4, 8, 12, 5, 35, 10, 65]
    const hourlyTime: string[] = []
    const hourlyCloud: number[] = []
    const hourlyRain: number[] = []
    for (let dayIndex = 0; dayIndex <= days; dayIndex += 1) {
      const date = new Date(today)
      date.setDate(date.getDate() + dayIndex)
      const dateKey = date.toISOString().slice(0, 10)
      for (let hour = 0; hour < 24; hour += 1) {
        hourlyTime.push(`${dateKey}T${String(hour).padStart(2, '0')}:00`)
        const nightIndex = hour < 6 ? Math.max(0, dayIndex - 1) : dayIndex
        hourlyCloud.push(hour >= 18 || hour < 6 ? (nightlyCloud[nightIndex] ?? 76) : 5)
        hourlyRain.push(hour >= 18 || hour < 6 ? (nightlyRain[nightIndex] ?? 65) : 0)
      }
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        timezone: 'Europe/London',
        daily: {
          time,
          // Deliberately identical daytime means: the UI must derive its
          // changing night scores from the hourly viewing window below.
          cloud_cover_mean: Array(days).fill(5),
          precipitation_probability_mean: Array(days).fill(0),
        },
        hourly: {
          time: hourlyTime,
          cloud_cover: hourlyCloud,
          cloud_cover_low: hourlyCloud,
          cloud_cover_high: hourlyCloud,
          precipitation_probability: hourlyRain,
        },
      }),
    })
  })

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
            id: 'e2e-mobile-activation-moon',
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
  await page.setViewportSize({ width: 390, height: 844 })
  await mockTonightData(page)
})

test('mobile signed-in user lands on visible-tonight feed', async ({ page }) => {
  const requestedForecastDays: string[] = []
  page.on('request', (request) => {
    if (request.url().startsWith('https://api.open-meteo.com/')) {
      requestedForecastDays.push(new URL(request.url()).searchParams.get('forecast_days') ?? '')
    }
  })
  await seedSignedInUser(page)
  await page.goto('/app/today')

  await expect(page.getByRole('heading', { name: /Tonight is live|Hold for a better window/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.dt-equipment-prompt')).toHaveCount(0)
  await expect(page.getByText(/local darkness \d\/5/i)).toBeVisible()
  await expect(page.getByText('Viewing conditions 1/5')).toBeVisible()
  await expect
    .poll(async () => new Set(await page.locator('.mobile-mini-row-name').filter({ hasText: 'Viewing conditions' }).allTextContents()).size)
    .toBeGreaterThan(1)
  await expect(page.getByText(/Sky quality \d\/5/)).toHaveCount(0)
  expect(requestedForecastDays).toContain('2')

  const target = page.locator('.dt-feed-row').first()
  await expect(target).toBeVisible()
  await expect(target).toContainText('Full Moon')
  await expect(target).toContainText(/naked-eye|needs binoculars or a scope/)
  await target.click()

  // First-ever tap also surfaces the equipment prompt; it takes the full
  // screen ahead of the entry detail page, so answer it before the entry is
  // reachable.
  const prompt = page.locator('.dt-equipment-prompt')
  await expect(prompt).toBeVisible()
  await prompt.getByRole('button', { name: 'Skip for now' }).click()
  await expect(prompt).toHaveCount(0)

  const entry = page.locator('.dt-entry')
  await expect(entry).toBeVisible()
  await expect(entry.getByRole('heading', { name: 'Full Moon' })).toBeVisible()
  await expect(entry.getByText('Bright and easy to frame with any phone camera.')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const taps = JSON.parse(window.localStorage.getItem('atlas-first-plan-target-taps') ?? '[]')
        return taps[0]
      }),
    )
    .toMatchObject({
      targetId: 'e2e-mobile-activation-moon',
      title: 'Full Moon',
      kind: 'moon_phase',
      source: 'mobile_hub',
      locationLabel: 'Melbourne',
    })
})

test('mobile equipment prompt waits for first target tap and saves gear choice', async ({ page }) => {
  await seedSignedInUser(page)
  await page.goto('/app/today')

  await expect(page.getByRole('heading', { name: /Tonight is live|Hold for a better window/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.dt-equipment-prompt')).toHaveCount(0)

  await page.locator('.dt-feed-row').first().click()
  const prompt = page.locator('.dt-equipment-prompt')
  await expect(prompt).toBeVisible()
  await prompt.getByRole('button', { name: 'My phone' }).click()

  await expect(prompt).toHaveCount(0)
  await expect(page.evaluate(() => window.localStorage.getItem('atlas-first-plan-equipment'))).resolves.toBe('phone')
  await expect(page.evaluate(() => window.localStorage.getItem('atlas-first-plan-equipment-dismissed'))).resolves.toBe('1')

  // Answering the prompt opens the entry it was blocking for the tapped target.
  const entry = page.locator('.dt-entry')
  await expect(entry).toBeVisible()
  await expect(entry.getByRole('heading', { name: 'Full Moon' })).toBeVisible()
  await entry.getByRole('button', { name: 'Back' }).click()
  await expect(entry).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('heading', { name: /Tonight is live|Hold for a better window/ })).toBeVisible({ timeout: 15_000 })
  await page.locator('.dt-feed-row').first().click()
  await expect(page.locator('.dt-equipment-prompt')).toHaveCount(0)
  await expect(page.locator('.dt-entry').getByRole('heading', { name: 'Full Moon' })).toBeVisible()
})

test('mobile signed-out visitor is blocked by the auth gate before reaching the feed', async ({ page }) => {
  await page.goto('/app/today')

  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Tonight is live|Hold for a better window/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Plan', exact: true })).toHaveCount(0)
})

test('mobile signed-in free user must checkout before using Plan', async ({ page }) => {
  await seedSignedInUser(page, { entitled: false })
  await page.goto('/app/today')

  await expect(page.getByRole('heading', { name: /Tonight is live|Hold for a better window/ })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Plan', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Unlock Planning with Sky Pass' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Get the Sky Pass' })).toBeVisible()
  await expect(page.getByLabel('Plan sections')).toHaveCount(0)
})

test('mobile entitled user can compare lower light pollution sites and routes', async ({ page }) => {
  await seedSignedInUser(page, { entitled: true })
  await page.goto('/app/today')

  await expect(page.getByRole('heading', { name: /Tonight is live|Hold for a better window/ })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Plan', exact: true }).click()
  await page.getByRole('button', { name: /Dark sites/i }).click()

  await expect(page.getByText(/Sky near .*:/)).toBeVisible()
  const route = page.getByRole('link', { name: 'Open Drive Route' }).first()
  if (await route.count()) {
    await expect(page.getByRole('button', { name: 'Apple' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Google' }).first()).toBeVisible()
    await expect(route).toHaveAttribute('href', /dirflg=d|travelmode=driving/)
  } else {
    await expect(page.getByText(/No quick trip is in the catalog yet|won.t suggest a flight/)).toBeVisible()
  }
})

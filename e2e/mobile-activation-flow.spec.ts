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

test('mobile signed-out visitor is blocked by the auth gate before reaching the feed', async ({ page }) => {
  await page.goto('/app/events')

  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Tonight is live|Hold for a better window/ })).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0)
})

test('mobile signed-in free user must checkout before using Plan', async ({ page }) => {
  await seedSignedInUser(page, { entitled: false })
  await page.goto('/app/events')

  await expect(page.getByRole('heading', { name: 'Events', exact: true })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Plan', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Unlock Planning with Sky Pass' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Get the Sky Pass' })).toBeVisible()
  await expect(page.getByLabel('Plan sections')).toHaveCount(0)
})

test('mobile entitled user can compare lower light pollution sites and routes', async ({ page }) => {
  await seedSignedInUser(page, { entitled: true })
  await page.goto('/app/events')

  await expect(page.getByRole('heading', { name: 'Events', exact: true })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Plan', exact: true }).click()
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

import { test, expect, type Page } from '@playwright/test'

// STS-333: proves a fresh, signed-out visitor can reach a first stargazing
// plan -- landing -> location entry -> signed-out feed -> target tap ->
// (optional) equipment prompt -> plan with all four sections -- without any
// signup prompt appearing along the way. Network calls that would otherwise
// make this flaky (weather, sky events) are mocked so the test is
// deterministic regardless of real-world conditions or the date it runs.

async function mockWeather(page: Page) {
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
        daily: {
          time,
          cloud_cover_mean: Array(days).fill(10),
          precipitation_probability_mean: Array(days).fill(5),
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
    const record = {
      id: 'e2e-full-moon',
      kind: 'moon_phase',
      target: 'moon',
      title: 'Full Moon',
      description: 'The Moon reaches its fullest point tonight.',
      content: 'The Moon reaches its fullest point tonight.',
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      latitude: 0,
      longitude: 0,
      updated: now.toISOString(),
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [record], page: 1, perPage: 500, totalItems: 1, totalPages: 1 }),
    })
  })
}

test.beforeEach(async ({ page }) => {
  await mockWeather(page)
  await mockSkyEvents(page)
})

test('signed-out visitor reaches a first plan before any signup prompt', async ({ page }) => {
  await page.goto('/')

  // Landing: enter a city manually (no geolocation permission needed).
  await expect(page.getByRole('heading', { name: 'What can I see in the sky tonight?' })).toBeVisible()
  await page.getByLabel('Where are you watching from?').fill('London')
  await page.getByRole('button', { name: "See tonight's sky" }).click()

  // Signed-out feed: reached without ever seeing a signup/account form.
  await expect(page.getByRole('heading', { name: /Tonight near/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.account-form')).toHaveCount(0)
  await expect(page.locator('.equipment-prompt')).toHaveCount(0)

  // First target tap -- expands the preview and, per STS-301/313, may show
  // the equipment prompt (only after this first tap, never before).
  const targetButton = page.locator('.tonight-target-main').first()
  await expect(targetButton).toBeVisible()
  await expect(targetButton).toContainText('Full Moon')
  await expect(targetButton).toContainText(/Phone-friendly|Tough for a phone/)
  await expect(targetButton).toContainText(/Naked-eye|Needs binoculars or a scope/)
  await targetButton.click()

  const equipmentPrompt = page.locator('.equipment-prompt')
  if (await equipmentPrompt.isVisible().catch(() => false)) {
    await equipmentPrompt.getByRole('button', { name: 'Skip for now' }).click()
  }

  // First plan: all four plan-screen sections (STS-302/316/317/318/319).
  const plan = page.locator('.tonight-target-plan').first()
  await expect(plan).toBeVisible()
  await expect(plan.getByText('You would see the Moon clearly, with shape, shadow, or surface detail visible by eye.')).toBeVisible()
  await expect(plan.locator('.best-time-timeline')).toBeVisible()
  await expect(plan.locator('.sky-direction-compass')).toBeVisible()
  await expect(plan.locator('.camera-preset-card')).toBeVisible()
  await expect(page.locator('.tonight-weather-badge')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const taps = JSON.parse(window.localStorage.getItem('atlas-first-plan-target-taps') ?? '[]')
        return taps[0]
      }),
    )
    .toMatchObject({
      targetId: 'e2e-full-moon',
      title: 'Full Moon',
      kind: 'moon_phase',
      source: 'tonight',
      locationLabel: 'London',
    })

  // Save action: "Log attempt" is available without an account (STS-320) --
  // clicking it must not itself trigger a signup wall.
  await page.getByRole('button', { name: 'Log attempt' }).first().click()
  await expect(page.locator('.account-form')).toHaveCount(0)

  // The whole journey above must never have shown a signup/account form.
  await expect(page.locator('.account-form')).toHaveCount(0)
})

test('equipment prompt appears after first target tap and persists recommendation state', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Where are you watching from?').fill('London')
  await page.getByRole('button', { name: "See tonight's sky" }).click()
  await expect(page.getByRole('heading', { name: /Tonight near/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.equipment-prompt')).toHaveCount(0)

  await page.locator('.tonight-target-main').first().click()
  const prompt = page.locator('.equipment-prompt')
  await expect(prompt).toBeVisible()
  await prompt.getByRole('button', { name: 'Just my eyes' }).click()

  await expect(prompt).toHaveCount(0)
  await expect(page.evaluate(() => window.localStorage.getItem('atlas-first-plan-equipment'))).resolves.toBe('eyes')
  await expect(page.evaluate(() => window.localStorage.getItem('atlas-first-plan-equipment-dismissed'))).resolves.toBe('1')
  await expect(page.getByText('Good match for eyes only.').first()).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Tonight near London' })).toBeVisible({ timeout: 15_000 })
  await page.locator('.tonight-target-main').first().click()
  await expect(page.locator('.equipment-prompt')).toHaveCount(0)
  await expect(page.getByText('Good match for eyes only.').first()).toBeVisible()
})

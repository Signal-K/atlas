import { test, expect, type Page } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

// STS-333: proves a signed-in visitor can reach a first stargazing plan --
// dashboard -> target tap -> (optional) equipment prompt -> entry detail
// with time/direction/camera/weather sections. "Get started" now requires
// an account before any of this (see AuthGate in App.tsx), so this suite
// seeds a signed-in session up front rather than testing the auth gate
// itself. Network calls that would otherwise make this flaky (weather, sky
// events) are mocked so the test is deterministic regardless of real-world
// conditions or the date it runs.

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
        timezone: 'Europe/London',
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
  // Onboarding is already marked done (default of seedSignedInUser) --
  // this suite isn't testing onboarding, so it would otherwise surface the
  // first-run OnboardingFlow overlay and block every click this journey
  // makes. Landing no longer collects a location itself (that moved into
  // OnboardingFlow's own "location" step), so seed it directly the same
  // way OnboardingFlow's setManualLocation() would.
  await seedSignedInUser(page)
  await page.addInitScript(() => {
    window.localStorage.setItem('atlas-manual-location', JSON.stringify({ name: 'London', lat: 51.5074, lon: -0.1278 }))
  })
})

test('signed-in visitor reaches a first plan', async ({ page }) => {
  await page.goto('/app/dashboard')

  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.dt-equipment-prompt')).toHaveCount(0)

  // First target tap -- opens the equipment prompt (only after this first
  // tap, never before) before landing on the entry detail page.
  const targetButton = page.getByRole('button', { name: 'Full Moon' })
  await expect(targetButton).toBeVisible()

  await targetButton.click()

  const equipmentPrompt = page.locator('.dt-equipment-prompt')
  if (await equipmentPrompt.isVisible().catch(() => false)) {
    await equipmentPrompt.locator('.dt-equipment-skip').click()
  }

  // First plan: entry detail's time/direction/camera/weather sections.
  await expect(page.getByRole('heading', { name: 'Full Moon' })).toBeVisible()
  await expect(page.getByText('Camera suitability')).toBeVisible()
  await expect(page.getByText('Best time tonight')).toBeVisible()
  await expect(page.locator('.dt-entry-timeline')).toBeVisible()
  await expect(page.getByText('Weather check')).toBeVisible()
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
      source: 'mobile_hub',
      locationLabel: 'London',
    })

  // Save action: "Log attempt" (STS-320) -- scoped to the entry detail's
  // own button, since HubView's "After observing" section renders a
  // same-named button underneath for the current top target.
  await page.locator('.dt-entry').getByRole('button', { name: 'Log attempt' }).click()
})

test('equipment prompt appears after first target tap and persists recommendation state', async ({ page }) => {
  await page.goto('/app/dashboard')

  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.dt-equipment-prompt')).toHaveCount(0)

  await page.getByRole('button', { name: 'Full Moon' }).click()
  const prompt = page.locator('.dt-equipment-prompt')
  await expect(prompt).toBeVisible()
  await prompt.getByRole('button', { name: 'Just my eyes' }).click()

  await expect(prompt).toHaveCount(0)
  await expect(page.evaluate(() => window.localStorage.getItem('atlas-first-plan-equipment'))).resolves.toBe('eyes')
  await expect(page.getByRole('heading', { name: 'Full Moon' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Full Moon' }).click()
  await expect(page.locator('.dt-equipment-prompt')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Full Moon' })).toBeVisible()
})

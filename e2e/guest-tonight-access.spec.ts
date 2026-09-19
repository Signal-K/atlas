import { test, expect, type Page } from '@playwright/test'

// ASV-47. Atlas's whole pitch is "tonight's sky for where you are", and until
// this change none of it was reachable without registering: every landing CTA,
// including "Set your location", navigated to a route that AuthGate blocked.
// A visitor who declined got Melbourne's twilight times and a signup form.
//
// These specs pin the boundary. Tonight is open; anything that persists across
// devices or costs money is not.

async function mockTonightData(page: Page) {
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
        timezone: 'Europe/Zurich',
        daily: {
          time,
          cloud_cover_mean: Array(days).fill(20),
          precipitation_probability_mean: Array(days).fill(5),
        },
      }),
    })
  })

  await page.route('**/api/collections/sky_events/records**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ page: 1, perPage: 200, totalItems: 0, totalPages: 0, items: [] }),
    })
  })
}

// Skipping the eight onboarding steps a guest now sees on entry lives in
// support/onboarding.ts -- onboarding moved ahead of sign-up because it is
// where a guest sets their location, so it is the first thing every spec that
// starts as a guest has to get past.

test.beforeEach(async ({ page }) => {
  await mockTonightData(page)
})

test("a visitor with no account reaches tonight's sky from the landing page", async ({ page }) => {
  await page.goto('/')

  // The label repeats across the masthead, hero, membership card and footer.
  await page.getByRole('button', { name: 'See tonight’s sky', exact: true }).first().click()
  await expect(page).toHaveURL('/app/hub')

  await expect(page.getByText("You're browsing as a guest.")).toBeVisible()
  // Not a signup form.
  await expect(page.getByRole('heading', { name: 'Create your free account' })).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pocketbase_auth'))).toBeFalsy()
})

test('a guest is never put through onboarding', async ({ page }) => {
  await page.goto('/app/hub')

  await expect(page.getByText("You're browsing as a guest.")).toBeVisible()
  await expect(page.getByRole('heading', { name: 'What should Atlas call you?' })).toHaveCount(0)

  await page.reload()
  await expect(page.getByText("You're browsing as a guest.")).toBeVisible()
  await expect(page.getByRole('heading', { name: 'What should Atlas call you?' })).toHaveCount(0)
})

test('a guest is offered their device location instead of the Melbourne default', async ({ page, context }) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 47.3769, longitude: 8.5417 })
  await page.goto('/app/hub')

  await expect(page.getByText(/until you share your location/)).toBeVisible()
  await page.getByRole('button', { name: 'Use my location' }).click()

  await expect(page.getByText(/until you share your location/)).toHaveCount(0, { timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Use my location' })).toHaveCount(0)
})

test('everything beyond tonight still requires an account', async ({ page }) => {
  for (const path of ['/app/events', '/app/planner', '/app/journal', '/app/profile']) {
    await page.goto(path)
    await expect(
      page.getByRole('heading', { name: /Create your free account|Welcome back/ }),
      `${path} must stay gated for a guest`,
    ).toBeVisible()
  }
})

test('the gate returns a guest to tonight rather than ejecting them to the landing page', async ({ page }) => {
  await page.goto('/app/hub')

  await page.getByRole('link', { name: /All events/ }).click()
  await expect(page.getByRole('heading', { name: /Create your free account|Welcome back/ })).toBeVisible()

  await page.getByRole('button', { name: /Back to tonight/ }).click()
  await expect(page).toHaveURL('/app/hub')
})

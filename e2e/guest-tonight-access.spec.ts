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

// Skips the four onboarding steps a guest now sees on entry. Onboarding moved
// ahead of sign-up because it is where a guest sets their location.
async function completeOnboarding(page: Page) {
  await expect(page.getByRole('heading', { name: 'What should Atlas call you?' })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('button', { name: 'Looks good' }).click()
  await page.getByRole('button', { name: 'Not now' }).click()
}

test.beforeEach(async ({ page }) => {
  await mockTonightData(page)
})

test("a visitor with no account reaches tonight's sky from the landing page", async ({ page }) => {
  await page.goto('/')

  // The label repeats across the masthead, hero, membership card and footer.
  await page.getByRole('button', { name: 'See tonight’s sky', exact: true }).first().click()
  await expect(page).toHaveURL('/app/hub')

  await completeOnboarding(page)

  await expect(page.getByText("You're browsing as a guest.")).toBeVisible()
  // Not a signup form.
  await expect(page.getByRole('heading', { name: 'Create your free account' })).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pocketbase_auth'))).toBeFalsy()
})

test('a guest can set a location without an account, and it survives a reload', async ({ page }) => {
  await page.goto('/app/hub')

  // Onboarding opens on the name step; the location step is third.
  await expect(page.getByRole('heading', { name: 'What should Atlas call you?' })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByRole('heading', { name: 'Where are you observing from?' })).toBeVisible()
  await page.getByPlaceholder(/Search for your town/).fill('Zurich')
  await page.getByText('Canton of Zurich, Switzerland').first().click()
  await page.getByRole('button', { name: /Use this location|Looks good/ }).click()
  await page.getByRole('button', { name: 'Not now' }).click()

  await expect(page.getByText(/Zurich/).first()).toBeVisible()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('atlas-manual-location'))).toContain('Zurich')

  await page.reload()
  await expect(page.getByText(/Zurich/).first()).toBeVisible()
  // Still no account anywhere in this journey.
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pocketbase_auth'))).toBeFalsy()
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
  await completeOnboarding(page)

  await page.getByRole('link', { name: /All events/ }).click()
  await expect(page.getByRole('heading', { name: /Create your free account|Welcome back/ })).toBeVisible()

  await page.getByRole('button', { name: /Back to tonight/ }).click()
  await expect(page).toHaveURL('/app/hub')
})

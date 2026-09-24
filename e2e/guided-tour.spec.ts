import { expect, test, type Page } from '@playwright/test'

async function mockTourData(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('atlas-manual-location', JSON.stringify({ name: 'Amsterdam', lat: 52.3676, lon: 4.9041, timeZone: 'Europe/Amsterdam' }))
    ;(window as unknown as { __atlasEvents: Array<{ name: string; properties?: Record<string, unknown> }> }).__atlasEvents = []
    window.addEventListener('atlas:analytics-event', ((event: CustomEvent) => {
      ;(window as unknown as { __atlasEvents: Array<{ name: string; properties?: Record<string, unknown> }> }).__atlasEvents.push(event.detail)
    }) as EventListener)
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        ;(window as unknown as { __sharedTour?: ShareData }).__sharedTour = data
      },
    })
  })

  await page.route('https://api.open-meteo.com/**', async (route) => {
    const time = Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() + index)
      return date.toISOString().slice(0, 10)
    })
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        timezone: 'Europe/Amsterdam',
        daily: {
          time,
          cloud_cover_mean: Array(7).fill(12),
          precipitation_probability_mean: Array(7).fill(2),
        },
      }),
    })
  })

  await page.route('**/api/collections/sky_events/records**', async (route) => {
    const start = new Date(Date.now() + 2 * 3_600_000)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        page: 1,
        perPage: 200,
        totalItems: 1,
        totalPages: 1,
        items: [{
          id: 'tour-saturn',
          kind: 'planet_event',
          target: 'saturn',
          title: 'Saturn after dark',
          description: 'Find Saturn above the southern horizon.',
          content: 'Find Saturn above the southern horizon.',
          starts_at: start.toISOString(),
          ends_at: new Date(start.getTime() + 5 * 3_600_000).toISOString(),
          updated: new Date().toISOString(),
        }],
      }),
    })
  })
}

test.beforeEach(async ({ page }) => {
  await mockTourData(page)
})

test('a guest completes the when/where/what tour, unlocks once, and can share it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'See tonight’s sky', exact: true }).first().click()
  await page.getByRole('button', { name: 'Start guided tour' }).click()

  await expect(page).toHaveURL('/app/hub?tour=tonight')
  await expect(page.getByRole('heading', { name: 'One useful plan. When, where, what.' })).toBeVisible()
  if (process.env.ATLAS_CAPTURE_SCREENSHOTS === '1') {
    await page.screenshot({ path: 'test-results/guided-tour-mobile.png', fullPage: false, animations: 'disabled' })
  }
  const chooseTarget = page.getByRole('button', { name: /^Choose / })
  await expect(chooseTarget).toBeVisible({ timeout: 15_000 })
  await chooseTarget.click()

  await expect(page.getByRole('heading', { name: 'When, where and what — ready.' })).toBeVisible()
  await page.getByRole('button', { name: 'Complete guided look' }).click()

  await expect(page.getByRole('heading', { name: 'Your first guided look is ready.' })).toBeVisible()
  if (process.env.ATLAS_CAPTURE_SCREENSHOTS === '1') {
    await page.screenshot({ path: 'test-results/guided-tour-complete-mobile.png', fullPage: false, animations: 'disabled' })
  }
  await page.getByRole('button', { name: 'Share this look' }).click()
  await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { __sharedTour?: ShareData }).__sharedTour?.url))).toBe(true)
  await page.getByRole('button', { name: 'Done for tonight' }).click()
  await expect(page.getByText(/First light.*first guided look is complete/i)).toBeVisible()

  const completion = await page.evaluate(() => JSON.parse(localStorage.getItem('atlas-first-tour-completion-v1') ?? 'null'))
  expect(completion).toMatchObject({ tourId: 'tonight-first-light-v1', badge: 'first_light' })
  const eventNames = await page.evaluate(() => (window as unknown as { __atlasEvents: Array<{ name: string }> }).__atlasEvents.map((event) => event.name))
  expect(eventNames).toEqual(expect.arrayContaining(['Tour started', 'Tour step viewed', 'Tour completed', 'Incentive unlocked', 'Return nudge shown', 'Tour shared']))

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Your first guided look is ready.' })).toHaveCount(0)
  await expect(page.getByText(/First light.*first guided look is complete/i)).toBeVisible()
})

test('a shared tour link lands in the guided entry rather than a blank hub', async ({ page }) => {
  await page.goto('/app/hub?tour=tonight&shared=1&target=tour-saturn')
  await expect(page.getByText('Shared guided look')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'One useful plan. When, where, what.' })).toBeVisible()
})

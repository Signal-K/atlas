import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const CAPTURE_DIR = path.join(process.cwd(), 'test-results', 'product-screenshots')

test.skip(process.env.ATLAS_CAPTURE_SCREENSHOTS !== '1', 'Set ATLAS_CAPTURE_SCREENSHOTS=1 to refresh product screenshots.')

test.beforeEach(async ({ page }) => {
  await mockProductData(page)
  // Location moved from the landing page into OnboardingFlow's own
  // "location" step -- seed it directly and skip onboarding so these
  // screenshots keep capturing the same screens as before that move.
  await page.addInitScript(() => {
    window.localStorage.setItem('atlas-onboarding-flow-complete', '1')
    window.localStorage.setItem('atlas-manual-location', JSON.stringify({ name: 'London', lat: 51.5074, lon: -0.1278 }))
  })
})

test('captures product screenshots for the Atlas state-of-product doc', async ({ page }) => {
  mkdirSync(CAPTURE_DIR, { recursive: true })

  await page.setViewportSize({ width: 1440, height: 1200 })
  await page.goto('/')
  await prepareScreenshotMode(page)
  await expect(page.getByRole('heading', { name: 'What can I see in the sky tonight?' })).toBeVisible()
  await capture(page, '01-landing-location.png')

  await page.getByRole('button', { name: 'Get started' }).click()
  await expect(page.getByRole('heading', { name: 'Tonight near London' })).toBeVisible({ timeout: 15_000 })
  await capture(page, '02-tonight-feed.png')

  await page.locator('.tonight-target-main').first().click()
  const equipmentPrompt = page.locator('.equipment-prompt')
  if (await equipmentPrompt.isVisible().catch(() => false)) {
    await equipmentPrompt.getByRole('button', { name: 'Skip for now' }).click()
  }
  const firstPlan = page.locator('.tonight-target-plan').first()
  await expect(firstPlan).toBeVisible()
  await expect(firstPlan.locator('.camera-preset-card')).toBeVisible()
  await capture(page, '03-first-plan-expanded.png')

  // The old Today hub (and its always-on full sky map) was removed for
  // being overloaded and poorly designed -- Events is the app's home
  // screen now. There's no single global "open sky map" trigger to shoot a
  // sky-map-dialog screenshot from anymore; EventPointing's compass overlay
  // is reached per-event via useEventPointing (see EventsView/PlanView) if
  // that shot is wanted back later.
  await page.setViewportSize({ width: 390, height: 844 })
  await mockDeviceOrientation(page)
  await page.goto('/app/events')
  await prepareScreenshotMode(page)
  await expect(page.getByRole('heading', { name: "Tonight's sky, reported." })).toBeVisible({ timeout: 15_000 })
  await capture(page, '06-mobile-events-hero.png')
})

async function capture(page: Page, filename: string) {
  await page.screenshot({
    path: path.join(CAPTURE_DIR, filename),
    fullPage: false,
    animations: 'disabled',
  })
}

async function prepareScreenshotMode(page: Page) {
  await page.addStyleTag({
    content: `
      .feedback-dock,
      .install-prompt,
      .feature-requester,
      .nps-feedback,
      [data-testid="feedback-dock"] {
        display: none !important;
      }
    `,
  })
}

async function mockProductData(page: Page) {
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
          cloud_cover_mean: [18, 12, 24, 30, 35, 42, 50],
          precipitation_probability_mean: [3, 4, 8, 10, 12, 15, 18],
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
            id: 'e2e-screenshot-full-moon',
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
          },
          {
            id: 'e2e-screenshot-iss-pass',
            kind: 'iss_pass',
            target: 'iss',
            title: 'ISS evening pass',
            description: 'A bright International Space Station pass crosses the southwest sky.',
            content: 'A bright International Space Station pass crosses the southwest sky.',
            starts_at: new Date(now.getTime() + 4 * 3_600_000).toISOString(),
            ends_at: new Date(now.getTime() + 4 * 3_600_000 + 8 * 60_000).toISOString(),
            latitude: 0,
            longitude: 0,
            updated: now.toISOString(),
          },
        ],
        page: 1,
        perPage: 500,
        totalItems: 2,
        totalPages: 1,
      }),
    })
  })
}

async function mockDeviceOrientation(page: Page) {
  await page.addInitScript(() => {
    class MockDeviceOrientationEvent extends Event {
      static async requestPermission() {
        return 'granted' as const
      }

      alpha: number | null
      beta: number | null
      gamma: number | null
      webkitCompassHeading: number | undefined

      constructor(type: string, init: DeviceOrientationEventInit & { webkitCompassHeading?: number } = {}) {
        super(type)
        this.alpha = init.alpha ?? null
        this.beta = init.beta ?? null
        this.gamma = init.gamma ?? null
        this.webkitCompassHeading = init.webkitCompassHeading
      }
    }

    Object.defineProperty(window, 'DeviceOrientationEvent', {
      configurable: true,
      writable: true,
      value: MockDeviceOrientationEvent,
    })
  })
}


import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const CAPTURE_DIR = path.join(process.cwd(), 'test-results', 'product-screenshots')

test.skip(process.env.ATLAS_CAPTURE_SCREENSHOTS !== '1', 'Set ATLAS_CAPTURE_SCREENSHOTS=1 to refresh product screenshots.')

test.beforeEach(async ({ page }) => {
  await mockProductData(page)
})

test('captures product screenshots for the Atlas state-of-product doc', async ({ page }) => {
  mkdirSync(CAPTURE_DIR, { recursive: true })

  await page.setViewportSize({ width: 1440, height: 1200 })
  await page.goto('/')
  await prepareScreenshotMode(page)
  await expect(page.getByRole('heading', { name: 'What can I see in the sky tonight?' })).toBeVisible()
  await capture(page, '01-landing-location.png')

  await page.getByLabel('Where are you watching from?').fill('London')
  await page.getByRole('button', { name: "See tonight's sky" }).click()
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

  await page.setViewportSize({ width: 390, height: 844 })
  await mockDeviceOrientation(page)
  await page.goto('/today')
  await prepareScreenshotMode(page)
  await expect(page.getByRole('heading', { name: /Tonight is live|Hold for a better window/ })).toBeVisible({ timeout: 15_000 })
  await capture(page, '04-mobile-today-hub.png')

  await page.getByRole('button', { name: 'Open full sky map' }).click()
  const map = page.getByRole('dialog', { name: 'Live sky map' })
  await expect(map).toBeVisible()
  await expect(map.locator('.mobile-map-overlay-body .sky-map-canvas')).toBeVisible()
  await expect.poll(() => canvasHasRenderedSky(page, '.mobile-map-overlay-body .sky-map-canvas')).toBe(true)
  await capture(page, '05-mobile-sky-map.png')
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

async function canvasHasRenderedSky(page: Page, selector: string) {
  return page.locator(selector).evaluate((canvasElement) => {
    const canvas = canvasElement as HTMLCanvasElement
    const context = canvas.getContext('2d')
    if (!context || canvas.width === 0 || canvas.height === 0) return false

    const sampleWidth = Math.min(canvas.width, 120)
    const sampleHeight = Math.min(canvas.height, 120)
    const startX = Math.floor((canvas.width - sampleWidth) / 2)
    const startY = Math.floor((canvas.height - sampleHeight) / 2)
    const pixels = context.getImageData(startX, startY, sampleWidth, sampleHeight).data
    let litPixels = 0
    const colors = new Set<string>()

    for (let i = 0; i < pixels.length; i += 16) {
      const r = pixels[i]
      const g = pixels[i + 1]
      const b = pixels[i + 2]
      const a = pixels[i + 3]
      if (a > 0 && (r > 8 || g > 8 || b > 8)) litPixels += 1
      colors.add(`${r >> 4}-${g >> 4}-${b >> 4}-${a >> 6}`)
      if (colors.size > 8 && litPixels > 80) return true
    }

    return colors.size > 8 && litPixels > 80
  })
}

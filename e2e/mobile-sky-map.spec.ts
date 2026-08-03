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

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        timezone: 'Europe/London',
        daily: {
          time,
          cloud_cover_mean: Array(days).fill(12),
          precipitation_probability_mean: Array(days).fill(4),
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
            id: 'e2e-mobile-map-moon',
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
        ],
        page: 1,
        perPage: 500,
        totalItems: 1,
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

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockDeviceOrientation(page)
  await mockTonightData(page)
  await seedSignedInUser(page)
})

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

test('mobile sky map opens as a rendered full-screen canvas with floating controls', async ({ page }) => {
  await page.goto('/app/today')

  const preview = page.getByRole('button', { name: 'Open full sky map' })
  await expect(preview).toBeVisible({ timeout: 15_000 })
  const previewBox = await preview.boundingBox()
  expect(previewBox?.height).toBeGreaterThan(0)
  const previewCanvasBox = await preview.locator('.sky-map-canvas').boundingBox()
  expect(previewCanvasBox?.height).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'Open full sky map' }).click()

  const map = page.getByRole('dialog', { name: 'Live sky map' })
  await expect(map).toBeVisible()
  await expect(map.locator('.mobile-map-overlay-body')).toBeVisible()

  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  const fullMapBox = await map.locator('.mobile-map-overlay-body').boundingBox()
  const fullCanvasBox = await map.locator('.mobile-map-overlay-body .sky-map-canvas').boundingBox()
  expect(fullMapBox?.width).toBe(viewport?.width)
  expect(fullMapBox?.height).toBe(viewport?.height)
  expect(fullCanvasBox?.width).toBe(viewport?.width)
  expect(fullCanvasBox?.height).toBe(viewport?.height)
  expect(fullCanvasBox?.height).toBeGreaterThan((previewCanvasBox?.height ?? 0) * 4)
  await expect.poll(() => canvasHasRenderedSky(page, '.mobile-map-overlay-body .sky-map-canvas')).toBe(true)

  await expect(map.locator('.mobile-map-time-control')).toHaveCSS('position', 'absolute')
  await expect(map.locator('.mobile-map-object-sheet')).toHaveCSS('position', 'absolute')
  await expect(map.locator('.mobile-map-visible-rail')).toHaveCSS('position', 'absolute')
  await expect(map.locator('.mobile-map-aim-readout')).toContainText('Phone is pointing at')
  await expect(map.locator('.mobile-map-aim-readout')).toContainText('Enable compass to aim the map')

  await map.getByRole('button', { name: 'Enable compass' }).click()
  await page.evaluate(() => {
    window.dispatchEvent(
      new (window.DeviceOrientationEvent as typeof DeviceOrientationEvent)('deviceorientation', {
        alpha: 90,
        beta: 70,
        gamma: 0,
        webkitCompassHeading: 270,
      } as DeviceOrientationEventInit & { webkitCompassHeading: number }),
    )
  })

  await expect(map.locator('.mobile-map-aim-readout')).toContainText(/270° heading|Phone is pointing at/)
  await expect(map.locator('.mobile-map-aim-readout')).not.toContainText('Enable compass to aim the map')

  const overlayZ = await page.locator('.mobile-map-overlay').evaluate((element) => Number(window.getComputedStyle(element).zIndex))
  const feedbackZ = await page.locator('.feedback-dock').evaluate((element) => Number(window.getComputedStyle(element).zIndex))
  expect(overlayZ).toBeGreaterThan(feedbackZ)
  await expect(page.locator('.feedback-dock')).toBeHidden()

  await map.getByRole('button', { name: 'Close sky map' }).click()
  await expect(map).toHaveCount(0)
  await expect(page.locator('.feedback-dock')).toBeVisible()
})

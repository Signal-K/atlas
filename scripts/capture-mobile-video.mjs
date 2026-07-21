import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { cp, rename, rm } from 'node:fs/promises'
import path from 'node:path'

const baseURL = process.env.ATLAS_CAPTURE_BASE_URL || 'http://127.0.0.1:5173'
const outputDir = path.join(process.cwd(), 'public', 'app-video')
const tempDir = path.join(process.cwd(), 'test-results', 'mobile-app-video')
const outputPath = path.join(outputDir, 'atlas-mobile-app-demo.webm')
const viewport = { width: 390, height: 844 }

mkdirSync(outputDir, { recursive: true })
mkdirSync(tempDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport,
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
  recordVideo: { dir: tempDir, size: viewport },
})
const page = await context.newPage()

await mockDeviceOrientation(page)
await seedDemoUser(page)
await mockProductData(page)

try {
  await page.goto(`${baseURL}/today`, { waitUntil: 'networkidle' })
  await prepareVideoMode(page)

  await hold(5_000)

  await page.getByRole('button', { name: /Change location/ }).click()
  await hold(5_000)
  await page.getByRole('button', { name: 'Back to Atlas' }).click()
  await hold(3_000)

  await page.locator('.dt-feed-row').first().click()
  await hold(6_000)

  const prompt = page.locator('.dt-equipment-prompt')
  if (await prompt.isVisible().catch(() => false)) {
    await prompt.getByRole('button', { name: 'My phone' }).click()
  }
  await hold(5_000)

  await page.getByRole('button', { name: 'Open full sky map' }).click()
  await hold(5_000)
  const map = page.getByRole('dialog', { name: 'Live sky map' })
  if (await map.getByRole('button', { name: 'Enable compass' }).isVisible().catch(() => false)) {
    await map.getByRole('button', { name: 'Enable compass' }).click()
    await page.evaluate(() => {
      window.dispatchEvent(
        new window.DeviceOrientationEvent('deviceorientation', {
          alpha: 90,
          beta: 70,
          gamma: 0,
          webkitCompassHeading: 270,
        }),
      )
    })
  }
  await hold(11_000)
  await map.getByRole('button', { name: 'Close sky map' }).click()
  await hold(3_000)

  await page.getByRole('button', { name: 'Events', exact: true }).click()
  await hold(7_000)
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByPlaceholder(/Search events/).fill('moon')
  await hold(5_000)
  await page.getByRole('button', { name: 'Events', exact: true }).click()
  await hold(2_000)

  await page.getByRole('button', { name: 'Plan', exact: true }).click()
  await hold(7_000)
  const firstEvent = page.locator('.mobile-event-browser button, .mobile-mini-row').first()
  if (await firstEvent.isVisible().catch(() => false)) {
    await firstEvent.click()
    await hold(7_000)
    await page.keyboard.press('Escape').catch(() => undefined)
    const closeButton = page.getByRole('button', { name: /close/i }).first()
    if (await closeButton.isVisible().catch(() => false)) await closeButton.click()
  }
  await hold(2_000)

  const darkSites = page.getByRole('button', { name: /Dark sites/i }).first()
  if (await darkSites.isVisible().catch(() => false)) {
    await darkSites.click()
    await hold(8_000)
    const back = page.getByRole('button', { name: /back/i }).first()
    if (await back.isVisible().catch(() => false)) await back.click()
  }
  await hold(3_000)

  await page.getByRole('button', { name: 'Journal', exact: true }).click()
  await hold(7_000)
  const publicTab = page.getByRole('button', { name: 'Public' }).first()
  if (await publicTab.isVisible().catch(() => false)) {
    await publicTab.click()
    await hold(5_000)
  }
  const archiveTab = page.getByRole('button', { name: 'Archive' }).first()
  if (await archiveTab.isVisible().catch(() => false)) {
    await archiveTab.click()
    await hold(5_000)
  }
  const privateTab = page.getByRole('button', { name: 'Private' }).first()
  if (await privateTab.isVisible().catch(() => false)) {
    await privateTab.click()
  }

  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await hold(24_000)
} finally {
  const video = page.video()
  await context.close()
  await browser.close()

  const rawVideoPath = await video.path()
  await rm(outputPath, { force: true })
  await cp(rawVideoPath, outputPath)
  await rename(rawVideoPath, path.join(tempDir, 'atlas-mobile-app-demo.raw.webm')).catch(() => undefined)
  console.log(outputPath)
}

async function hold(ms) {
  await page.waitForTimeout(ms)
}

async function seedDemoUser(page) {
  await page.addInitScript(() => {
    const payload = {
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
      type: 'auth',
      collectionId: 'users',
    }
    const token = ['video', btoa(JSON.stringify(payload)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''), 'sig'].join('.')
    window.localStorage.setItem(
      'pocketbase_auth',
      JSON.stringify({
        token,
        record: {
          id: 'video-mobile-user',
          email: 'demo@youratlas.cc',
          entitled: true,
        },
      }),
    )
    window.localStorage.setItem('atlas-first-plan-equipment', 'phone')
    window.localStorage.setItem('atlas-first-plan-equipment-dismissed', '1')
    window.localStorage.setItem(
      'atlas-manual-location',
      JSON.stringify({
        name: 'London',
        lat: 51.5074,
        lon: -0.1278,
        admin1: 'England',
        country: 'United Kingdom',
        timeZone: 'Europe/London',
      }),
    )
  })
}

async function prepareVideoMode(page) {
  await page.addStyleTag({
    content: `
      .feedback-dock,
      .install-prompt,
      .feature-requester,
      .nps-feedback,
      [data-testid="feedback-dock"] {
        display: none !important;
      }
      * {
        caret-color: transparent !important;
      }
    `,
  })
}

async function mockProductData(page) {
  await page.route('https://api.open-meteo.com/**', async (route) => {
    const days = 90
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
          cloud_cover_mean: Array.from({ length: days }, (_, i) => [12, 18, 24, 30, 16, 22, 28][i % 7]),
          precipitation_probability_mean: Array.from({ length: days }, (_, i) => [3, 4, 8, 10, 5, 6, 12][i % 7]),
        },
      }),
    })
  })

  await page.route('**/api/collections/sky_events/records**', async (route) => {
    const now = new Date()
    const inHours = (hours, durationMinutes = 60) => {
      const startsAt = new Date(now.getTime() + hours * 3_600_000)
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000)
      return { starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() }
    }
    const updated = now.toISOString()
    const items = [
      {
        id: 'video-full-moon',
        kind: 'moon_phase',
        target: 'moon',
        title: 'Full Moon',
        description: 'The Moon reaches its fullest point tonight.',
        content: 'The Moon reaches its fullest point tonight.',
        latitude: 0,
        longitude: 0,
        updated,
        ...inHours(2, 90),
      },
      {
        id: 'video-iss-pass',
        kind: 'iss_pass',
        target: 'iss',
        title: 'ISS evening pass',
        description: 'A bright International Space Station pass crosses the southwest sky.',
        content: 'A bright International Space Station pass crosses the southwest sky.',
        latitude: 0,
        longitude: 0,
        updated,
        ...inHours(4, 8),
      },
      {
        id: 'video-meteor-shower',
        kind: 'meteor_shower',
        target: 'perseids',
        title: 'Perseids meteor watch',
        description: 'A patient naked-eye target for dark skies after midnight.',
        content: 'A patient naked-eye target for dark skies after midnight.',
        latitude: 0,
        longitude: 0,
        updated,
        ...inHours(28, 240),
      },
      {
        id: 'video-jupiter',
        kind: 'planet',
        target: 'jupiter',
        title: 'Jupiter before dawn',
        description: 'Bright Jupiter is easy to spot by eye and a strong phone landmark target.',
        content: 'Bright Jupiter is easy to spot by eye and a strong phone landmark target.',
        latitude: 0,
        longitude: 0,
        updated,
        ...inHours(34, 120),
      },
      {
        id: 'video-conjunction',
        kind: 'conjunction',
        target: 'venus-jupiter',
        title: 'Venus and Jupiter close approach',
        description: 'Two bright planets sit close together in twilight.',
        content: 'Two bright planets sit close together in twilight.',
        latitude: 0,
        longitude: 0,
        updated,
        ...inHours(58, 90),
      },
    ]

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items,
        page: 1,
        perPage: 500,
        totalItems: items.length,
        totalPages: 1,
      }),
    })
  })
}

async function mockDeviceOrientation(page) {
  await page.addInitScript(() => {
    class MockDeviceOrientationEvent extends Event {
      static async requestPermission() {
        return 'granted'
      }

      constructor(type, init = {}) {
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

import { expect, test, type Browser, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { seedSignedInUser } from './support/auth'

const CAPTURE_DIR = path.join(process.cwd(), 'test-results', 'surface-audit')

test.skip(process.env.ATLAS_CAPTURE_SURFACES !== '1', 'Set ATLAS_CAPTURE_SURFACES=1 to run the rendered surface audit.')

const surfaces = [
  { slug: 'hub', path: '/app/hub', heading: /Good night for it\.|Tonight/ },
  { slug: 'events', path: '/app/events', heading: 'Events' },
  { slug: 'calendar', path: '/app/calendar', heading: 'Calendar' },
  { slug: 'planner', path: '/app/planner', heading: 'Planner' },
  { slug: 'journal', path: '/app/journal', heading: 'Journal' },
  { slug: 'ask', path: '/app/ask', heading: 'Ask Atlas' },
  { slug: 'profile', path: '/app/profile', heading: 'You' },
] as const

test.beforeEach(async ({ page }) => {
  await seedSignedInUser(page, { entitled: true })
  await page.route('https://api.open-meteo.com/**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        timezone: 'Europe/London',
        daily: {
          time: Array.from({ length: 7 }, (_, i) => new Date(Date.now() + i * 86_400_000).toISOString().slice(0, 10)),
          cloud_cover_mean: [18, 12, 24, 30, 35, 42, 50],
          precipitation_probability_mean: [3, 4, 8, 10, 12, 15, 18],
        },
      }),
    })
  })
})

async function captureSurfaces(page: Page, viewport: { width: number; height: number }, prefix: string) {
  await page.setViewportSize(viewport)
  for (const surface of surfaces) {
    await page.goto(surface.path)
    await expect(page.getByRole('heading', { name: surface.heading, exact: typeof surface.heading === 'string' })).toBeVisible({ timeout: 15_000 })
    await page.screenshot({ path: path.join(CAPTURE_DIR, `${prefix}-${surface.slug}.png`), fullPage: false, animations: 'disabled' })
  }
}

test('captures every primary product surface at desktop and mobile breakpoints', async ({ page }) => {
  mkdirSync(CAPTURE_DIR, { recursive: true })
  await captureSurfaces(page, { width: 1440, height: 1000 }, 'desktop')
  await captureSurfaces(page, { width: 390, height: 844 }, 'mobile')
})

test('captures shared overlays and sheets', async ({ page }) => {
  mkdirSync(CAPTURE_DIR, { recursive: true })
  await page.setViewportSize({ width: 390, height: 844 })

  await page.goto('/app/events')
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(page.getByRole('dialog', { name: 'Primary navigation' })).toBeVisible()
  await page.screenshot({ path: path.join(CAPTURE_DIR, 'mobile-navigation.png'), fullPage: false, animations: 'disabled' })

  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page.getByPlaceholder('Events, targets, places, entries')).toBeVisible()
  await page.screenshot({ path: path.join(CAPTURE_DIR, 'mobile-search.png'), fullPage: false, animations: 'disabled' })

  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.goto('/app/profile')
  await page.getByRole('button', { name: /Location & sensors/ }).click()
  await expect(page.getByRole('dialog', { name: 'Observing location' })).toBeVisible()
  await page.screenshot({ path: path.join(CAPTURE_DIR, 'mobile-location-sheet.png'), fullPage: false, animations: 'disabled' })

  await page.getByRole('button', { name: 'Close' }).click()
  await page.goto('/app/planner')
  await page.getByRole('button', { name: 'Start a plan' }).click()
  await expect(page.getByRole('dialog', { name: 'Build an itinerary' })).toBeVisible()
  await page.screenshot({ path: path.join(CAPTURE_DIR, 'mobile-itinerary-sheet.png'), fullPage: false, animations: 'disabled' })
})

async function freshPage(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  return { context, page: await context.newPage() }
}

test('captures public, guest, onboarding, and paywall states', async ({ browser }) => {
  mkdirSync(CAPTURE_DIR, { recursive: true })

  const guest = await freshPage(browser)
  await guest.page.goto('/')
  await guest.page.getByRole('button', { name: 'See tonight’s sky', exact: true }).first().click()
  await expect(guest.page.getByRole('heading', { name: 'How would you like to begin?' })).toBeVisible()
  await guest.page.screenshot({ path: path.join(CAPTURE_DIR, 'mobile-landing-entry-choice.png'), fullPage: false, animations: 'disabled' })
  await guest.page.goto('/app/events')
  await expect(guest.page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await guest.page.screenshot({ path: path.join(CAPTURE_DIR, 'mobile-auth-gate.png'), fullPage: false, animations: 'disabled' })
  await guest.context.close()

  const onboarding = await freshPage(browser)
  await seedSignedInUser(onboarding.page, { onboardingComplete: false })
  await onboarding.page.goto('/app/hub')
  await expect(onboarding.page.getByRole('heading', { name: /What should Atlas call you/ })).toBeVisible()
  await onboarding.page.screenshot({ path: path.join(CAPTURE_DIR, 'mobile-onboarding.png'), fullPage: false, animations: 'disabled' })
  await onboarding.context.close()

  const free = await freshPage(browser)
  await seedSignedInUser(free.page, { entitled: false })
  await free.page.goto('/app/planner')
  await expect(free.page.getByRole('heading', { name: 'Plan the whole trip, not just tonight' })).toBeVisible()
  await free.page.screenshot({ path: path.join(CAPTURE_DIR, 'mobile-paywall.png'), fullPage: false, animations: 'disabled' })
  await free.context.close()

  const publicPage = await freshPage(browser)
  await publicPage.page.goto('/p/not-a-real-share')
  await expect(publicPage.page.getByRole('heading', { name: 'This shared observation isn’t available.' })).toBeVisible()
  await expect(publicPage.page.getByRole('link', { name: 'Explore tonight’s sky' })).toHaveAttribute('href', '/')
  await publicPage.page.evaluate(() => window.scrollTo(0, 0))
  await publicPage.page.screenshot({ path: path.join(CAPTURE_DIR, 'mobile-public-share-missing.png'), fullPage: false, animations: 'disabled' })
  await publicPage.page.goto('/stamps/not-a-real-stamp')
  await expect(publicPage.page.getByRole('heading', { name: 'This city stamp isn’t available.' })).toBeVisible()
  await expect(publicPage.page.getByRole('link', { name: 'Explore tonight’s sky' })).toHaveAttribute('href', '/')
  await publicPage.page.evaluate(() => window.scrollTo(0, 0))
  await publicPage.page.screenshot({ path: path.join(CAPTURE_DIR, 'mobile-city-stamp-missing.png'), fullPage: false, animations: 'disabled' })
  await publicPage.context.close()
})

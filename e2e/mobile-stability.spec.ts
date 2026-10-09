import { expect, test, type Page } from '@playwright/test'
import { seedSignedInUser } from './support/auth'
import { strippedJpeg } from './support/exifImage'

const MOBILE_VIEWPORT = { width: 390, height: 844 }

async function installClsObserver(page: Page) {
  await page.addInitScript(() => {
    ;(window as Window & { __atlasCls?: number }).__atlasCls = 0
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { value?: number; hadRecentInput?: boolean }>) {
        if (entry.hadRecentInput) continue
        ;(window as Window & { __atlasCls?: number }).__atlasCls =
          ((window as Window & { __atlasCls?: number }).__atlasCls ?? 0) + (entry.value ?? 0)
      }
    })
    observer.observe({ type: 'layout-shift', buffered: true })
  })
}

async function resetCls(page: Page) {
  await page.evaluate(() => {
    ;(window as Window & { __atlasCls?: number }).__atlasCls = 0
  })
}

async function readCls(page: Page) {
  return page.evaluate(() => (window as Window & { __atlasCls?: number }).__atlasCls ?? 0)
}

async function mockSkyTraffic(page: Page, delayMs = 280) {
  await page.route('https://api.open-meteo.com/**', async (route) => {
    await page.waitForTimeout(delayMs)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ timezone: 'Europe/London', daily: { time: [], cloud_cover_mean: [], precipitation_probability_mean: [] } }),
    })
  })
  await page.route('**/api/collections/sky_events/records**', async (route) => {
    await page.waitForTimeout(delayMs)
    const start = new Date(Date.now() + 3_600_000)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        page: 1,
        perPage: 200,
        totalItems: 1,
        totalPages: 1,
        items: [
          {
            id: 'mobile-stability-saturn',
            kind: 'planet_event',
            target: 'saturn',
            title: 'Saturn after dark',
            description: 'x',
            content: 'x',
            starts_at: start.toISOString(),
            ends_at: new Date(start.getTime() + 3_600_000).toISOString(),
            updated: new Date().toISOString(),
          },
        ],
      }),
    })
  })
}

async function visibleViewportBounds(page: Page) {
  return page.evaluate(() => {
    const viewport = window.visualViewport
    if (!viewport) {
      const height = Math.round(window.innerHeight)
      return { top: 0, bottom: height, height }
    }
    const top = Math.round(viewport.offsetTop)
    const bottom = Math.round(viewport.offsetTop + viewport.height)
    const height = Math.round(viewport.height)
    return { top, bottom, height }
  })
}

function boxDelta(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: Math.abs(a.x - b.x), y: Math.abs(a.y - b.y) }
}

async function buttonAndFieldPositions(page: Page) {
  const field = page.locator('.auth-gate-modal input').first()
  const submit = page.locator('.auth-gate-modal .account-form-submit')
  await expect(field).toBeVisible()
  await expect(submit).toBeVisible()
  const fieldBox = await field.boundingBox()
  const submitBox = await submit.boundingBox()
  if (!fieldBox || !submitBox) throw new Error('Expected auth field and submit button bounding boxes')
  return {
    field: { x: fieldBox.x, y: fieldBox.y },
    submit: { x: submitBox.x, y: submitBox.y, width: submitBox.width },
  }
}

test.describe('mobile stability', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
  })

  test('CLS stays below 0.05 on hub, journal, and auth gate', async ({ page }) => {
    await installClsObserver(page)
    await mockSkyTraffic(page)
    await seedSignedInUser(page, { entitled: true })

    await page.goto('/app/hub', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /night/i })).toBeVisible()
    await page.waitForTimeout(2200)
    const hubCls = await readCls(page)
    expect(hubCls).toBeLessThan(0.05)

    await resetCls(page)
    await page.goto('/app/journal', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Journal' })).toBeVisible()
    await page.waitForTimeout(2200)
    const journalCls = await readCls(page)
    expect(journalCls).toBeLessThan(0.05)

    const guestPage = await page.context().newPage()
    await guestPage.setViewportSize(MOBILE_VIEWPORT)
    await guestPage.addInitScript(() => {
      window.localStorage.removeItem('pocketbase_auth')
      window.localStorage.removeItem('atlas-entered')
    })
    await installClsObserver(guestPage)
    await guestPage.goto('/app/journal', { waitUntil: 'domcontentloaded' })
    await expect(guestPage.locator('.auth-gate-modal')).toBeVisible()
    await guestPage.waitForTimeout(2200)
    const authCls = await readCls(guestPage)
    expect(authCls).toBeLessThan(0.05)
    await guestPage.close()
  })

  test('auth form keeps field and submit positions stable across mount, busy, and error states', async ({ page }) => {
    await page.route('**/v1/client/**', async (route) => {
      await page.waitForTimeout(280)
      await route.continue()
    })

    await page.goto('/app/journal')
    await expect(page.locator('.auth-gate-modal')).toBeVisible()

    const notConfigured = page.getByText('Sign-in is not configured on this deployment.')
    if (await notConfigured.isVisible()) test.skip(true, 'Clerk is not configured in this environment')

    const email = page.locator('#clerk-sign-in-email')
    const password = page.locator('#clerk-sign-in-password')
    const submit = page.locator('.auth-gate-modal .account-form-submit')

    await expect(email).toBeVisible()
    await expect(password).toBeVisible()
    await email.fill('mobile-layout@example.com')
    await password.fill('not-the-right-password')

    // Switching modes must preserve what was typed in Sign in.
    await page.getByRole('tab', { name: 'Create account' }).click()
    await page.getByRole('tab', { name: 'Sign in' }).click()
    await expect(email).toHaveValue('mobile-layout@example.com')

    const before = await buttonAndFieldPositions(page)
    await submit.click()
    await expect
      .poll(async () => (await submit.getAttribute('aria-busy')) === 'true' || (await page.locator('.az-form-status.has-message').count()) > 0)
      .toBeTruthy()
    const busyBox = await submit.boundingBox()
    expect(Math.abs((busyBox?.width ?? before.submit.width) - before.submit.width)).toBeLessThanOrEqual(2)

    await expect(page.locator('.az-form-status.has-message')).toBeVisible({ timeout: 15_000 })
    const after = await buttonAndFieldPositions(page)
    const fieldDelta = boxDelta(before.field, after.field)
    const submitDelta = boxDelta(before.submit, after.submit)
    expect(fieldDelta.y).toBeLessThanOrEqual(3)
    expect(submitDelta.y).toBeLessThanOrEqual(3)
  })

  test('keyboard-size viewport changes keep focused controls and submit actions visible in capture and photo sheets', async ({ page }) => {
    await seedSignedInUser(page, { entitled: true })
    await page.goto('/app/journal')

    const applyViewport = async (height: number) => {
      await page.setViewportSize({ width: MOBILE_VIEWPORT.width, height })
    }

    await page.getByRole('button', { name: "Log tonight's session" }).click()
    const captureField = page.locator('.az-sheet textarea')
    const captureSubmit = page.getByRole('button', { name: 'Save session' })
    await captureField.fill('Captured around midnight near the park.')
    await captureField.focus()

    await applyViewport(620)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))
    const captureViewport = await visibleViewportBounds(page)
    expect(captureViewport.height).toBeLessThanOrEqual(625)
    await expect(captureField).toBeVisible()
    await expect(captureSubmit).toBeVisible()
    await page.waitForTimeout(360)
    const captureSettledA = {
      field: await captureField.boundingBox(),
      submit: await captureSubmit.boundingBox(),
    }
    await page.waitForTimeout(240)
    const captureSettledB = {
      field: await captureField.boundingBox(),
      submit: await captureSubmit.boundingBox(),
    }
    if (!captureSettledA.field || !captureSettledA.submit || !captureSettledB.field || !captureSettledB.submit) {
      throw new Error('Expected capture sheet boxes')
    }
    expect(captureSettledA.field.y).toBeGreaterThanOrEqual(captureViewport.top - 4)
    expect(captureSettledA.submit.y).toBeGreaterThanOrEqual(captureViewport.top - 4)
    expect(captureSettledA.field.y + captureSettledA.field.height).toBeLessThanOrEqual(captureViewport.bottom + 4)
    expect(captureSettledA.submit.y + captureSettledA.submit.height).toBeLessThanOrEqual(captureViewport.bottom + 4)
    expect(Math.abs(captureSettledB.field.y - captureSettledA.field.y)).toBeLessThanOrEqual(6)
    expect(Math.abs(captureSettledB.submit.y - captureSettledA.submit.y)).toBeLessThanOrEqual(6)

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.locator('.az-sheet[aria-label="Log tonight\'s session"]')).toBeHidden()

    await applyViewport(MOBILE_VIEWPORT.height)
    await page.getByRole('button', { name: 'Identify a sky photo' }).click()
    await page.locator('#photo-sky-id-file').setInputFiles(strippedJpeg('mobile-photo.jpg'))
    const photoField = page.locator('#photo-sky-id-location')
    const photoSubmit = page.getByRole('button', { name: "Identify what's in frame" })
    await expect(photoField).toBeVisible({ timeout: 15_000 })
    await photoField.focus()

    await applyViewport(620)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))
    const photoViewport = await visibleViewportBounds(page)
    expect(photoViewport.height).toBeLessThanOrEqual(625)
    await expect(photoSubmit).toBeVisible()
    await page.waitForTimeout(360)
    const photoSettledA = {
      field: await photoField.boundingBox(),
      submit: await photoSubmit.boundingBox(),
    }
    await page.waitForTimeout(240)
    const photoSettledB = {
      field: await photoField.boundingBox(),
      submit: await photoSubmit.boundingBox(),
    }
    if (!photoSettledA.field || !photoSettledA.submit || !photoSettledB.field || !photoSettledB.submit) {
      throw new Error('Expected photo sheet boxes')
    }
    expect(photoSettledA.field.y).toBeGreaterThanOrEqual(photoViewport.top - 4)
    expect(photoSettledA.submit.y).toBeGreaterThanOrEqual(photoViewport.top - 4)
    expect(photoSettledA.field.y + photoSettledA.field.height).toBeLessThanOrEqual(photoViewport.bottom + 4)
    expect(photoSettledA.submit.y + photoSettledA.submit.height).toBeLessThanOrEqual(photoViewport.bottom + 4)
    expect(Math.abs(photoSettledB.field.y - photoSettledA.field.y)).toBeLessThanOrEqual(6)
    expect(Math.abs(photoSettledB.submit.y - photoSettledA.submit.y)).toBeLessThanOrEqual(6)
  })

  test('double submit sends one write, dirty close confirms, and failed push can be retried from queue', async ({ page }) => {
    await seedSignedInUser(page, { entitled: true })

    let createCount = 0
    let failWrites = false
    await page.route('**/api/collections/atlas_observations/records', async (route) => {
      createCount += 1
      if (failWrites) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'temporary failure' }),
        })
        return
      }
      await page.waitForTimeout(250)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: `obs-${createCount}` }),
      })
    })

    await page.goto('/app/journal')
    await page.getByRole('button', { name: "Log tonight's session" }).click()
    const note = page.locator('.az-sheet textarea')
    const save = page.getByRole('button', { name: 'Save session' })
    await note.fill('Double tap should write once.')
    await save.evaluate((button) => {
      ;(button as HTMLButtonElement).click()
      ;(button as HTMLButtonElement).click()
    })
    await expect(page.locator('.az-sheet[aria-label="Log tonight\'s session"]')).toBeHidden({ timeout: 15_000 })
    expect(createCount).toBe(1)

    await page.getByRole('button', { name: "Log tonight's session" }).click()
    await note.fill('Unsaved draft should confirm on close.')
    page.once('dialog', (dialog) => dialog.dismiss())
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.locator('.az-sheet[aria-label="Log tonight\'s session"]')).toBeVisible()
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.locator('.az-sheet[aria-label="Log tonight\'s session"]')).toBeHidden()

    failWrites = true
    await page.getByRole('button', { name: "Log tonight's session" }).click()
    await note.fill('Queue this local save when push fails.')
    await save.click()
    await expect(page.locator('.az-sheet[aria-label="Log tonight\'s session"]')).toBeVisible()
    await expect(page.getByText('Atlas queued a retry to sync your account.')).toBeVisible()

    failWrites = false
    await page.getByRole('button', { name: 'Retry sync' }).click()
    await expect(page.locator('.az-sheet[aria-label="Log tonight\'s session"]')).toBeHidden({ timeout: 15_000 })
  })

  test('form attributes and touch-target sizes meet mobile constraints', async ({ page }) => {
    await seedSignedInUser(page, { entitled: true })
    await page.goto('/app/hub')
    await page.locator('.az-location-chip').click()

    const locationField = page.locator('.location-search input')
    await expect(locationField).toHaveAttribute('enterkeyhint', 'search')
    await expect(locationField).toHaveAttribute('spellcheck', 'false')
    await expect(locationField).toHaveAttribute('autocorrect', 'off')

    const guestPage = await page.context().newPage()
    await guestPage.setViewportSize(MOBILE_VIEWPORT)
    await guestPage.addInitScript(() => {
      window.localStorage.removeItem('pocketbase_auth')
      window.localStorage.removeItem('atlas-entered')
    })
    await guestPage.goto('/app/journal')

    const notConfigured = guestPage.getByText('Sign-in is not configured on this deployment.')
    if (!(await notConfigured.isVisible())) {
      await expect(guestPage.locator('#clerk-sign-in-email')).toHaveAttribute('inputmode', 'email')
      await expect(guestPage.locator('#clerk-sign-in-email')).toHaveAttribute('autocapitalize', 'none')
      await expect(guestPage.locator('#clerk-sign-in-email')).toHaveAttribute('autocorrect', 'off')
      await expect(guestPage.locator('#clerk-sign-in-email')).toHaveAttribute('spellcheck', 'false')
      await expect(guestPage.locator('#clerk-sign-in-password')).toHaveAttribute('autocapitalize', 'none')
      await expect(guestPage.locator('#clerk-sign-in-password')).toHaveAttribute('autocorrect', 'off')
      await expect(guestPage.locator('#clerk-sign-in-password')).toHaveAttribute('spellcheck', 'false')
    }
    await guestPage.close()

    await seedSignedInUser(page, { entitled: true })
    await page.goto('/app/hub')
    const undersized = await page.evaluate(() => {
      const selectors = ['button.az-icon-btn', 'button.az-chip', '.az-location-chip', 'button.az-btn', 'button.az-text-btn']
      const min = 43.5
      const small: string[] = []
      for (const selector of selectors) {
        for (const node of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
          const style = window.getComputedStyle(node)
          if (style.display === 'none' || style.visibility === 'hidden') continue
          if (!node.offsetParent) continue
          const box = node.getBoundingClientRect()
          if (box.width > 0 && box.height > 0 && (box.width < min || box.height < min)) {
            const label = (node.getAttribute('aria-label') || node.textContent || selector).trim().slice(0, 48)
            small.push(`${label}: ${Math.round(box.width)}x${Math.round(box.height)}`)
          }
        }
      }
      return small
    })
    expect(undersized).toEqual([])
  })
})

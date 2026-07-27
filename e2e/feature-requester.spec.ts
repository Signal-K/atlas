import { test, expect, type Page } from '@playwright/test'

async function captureAnalytics(page: Page) {
  await page.evaluate(() => {
    window.__atlasCapturedEvents = []
    window.addEventListener('atlas:analytics-event', (event) => {
      window.__atlasCapturedEvents.push((event as CustomEvent).detail)
    })
  })
}

async function latestFeatureRequest(page: Page) {
  return page.evaluate(() => window.__atlasCapturedEvents.findLast((event) => event.name === 'Feature request submitted'))
}

declare global {
  interface Window {
    __atlasCapturedEvents: Array<{ name: string; properties?: Record<string, unknown> }>
  }
}

test('signed-out desktop user submits a feature request without leaving the app', async ({ page }) => {
  await page.goto('/app/tonight')
  await captureAnalytics(page)

  await page.getByRole('button', { name: 'Request feature' }).click()
  await expect(page.getByRole('dialog', { name: 'Request a feature' })).toBeVisible()
  await page.getByLabel('Feature idea').fill('Add a red-light observing mode')
  await page.getByLabel('Email for follow-up').fill('observer@example.com')
  await page.getByRole('button', { name: 'Send request' }).click()

  await expect(page.getByRole('dialog', { name: 'Request a feature' })).toHaveCount(0)
  await expect(page).toHaveURL('/app/tonight')
  await expect(page.locator('.account-form')).toHaveCount(0)

  const event = await latestFeatureRequest(page)
  expect(event?.properties).toMatchObject({
    request: 'Add a red-light observing mode',
    requestLength: 30,
    email: 'observer@example.com',
    signedIn: false,
    source: 'feedback_dock',
    path: '/app/tonight',
    route: '/app/tonight',
  })
  expect(event?.properties?.$set).toMatchObject({ email: 'observer@example.com', signedIn: false })
})

test('signed-out mobile user submits a feature request without leaving the app', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/today')
  await captureAnalytics(page)

  await page.getByRole('button', { name: 'Request feature' }).click()
  await expect(page.getByRole('dialog', { name: 'Request a feature' })).toBeVisible()
  await page.getByLabel('Feature idea').fill('Add an offline stargazing checklist')
  await page.getByLabel('Email for follow-up').fill('mobile@example.com')
  await page.getByRole('button', { name: 'Send request' }).click()

  await expect(page.getByRole('dialog', { name: 'Request a feature' })).toHaveCount(0)
  await expect(page).toHaveURL('/app/today')
  await expect(page.locator('.account-form')).toHaveCount(0)

  const event = await latestFeatureRequest(page)
  expect(event?.properties).toMatchObject({
    request: 'Add an offline stargazing checklist',
    requestLength: 35,
    email: 'mobile@example.com',
    signedIn: false,
    source: 'feedback_dock',
    path: '/app/today',
    route: '/app/today',
  })
  expect(event?.properties?.$set).toMatchObject({ email: 'mobile@example.com', signedIn: false })
})

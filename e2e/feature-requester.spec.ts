import { test, expect, type Page } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

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

// FeedbackDock (and the whole app shell) now only renders once signed in
// -- see AuthGate in App.tsx -- so a "signed-out" feature request is no
// longer a reachable state. Signed-in users don't see the email field at
// all; FeedbackDock uses the account's own email (src/components/FeedbackDock.tsx).
test('signed-in desktop user submits a feature request without leaving the app', async ({ page }) => {
  await seedSignedInUser(page, { email: 'observer@example.com' })
  await page.goto('/app/events')
  await captureAnalytics(page)

  await page.getByRole('button', { name: 'Request feature' }).click()
  await expect(page.getByRole('dialog', { name: 'Request a feature' })).toBeVisible()
  await page.getByLabel('Feature idea').fill('Add a red-light observing mode')
  await expect(page.getByLabel('Email for follow-up')).toHaveCount(0)
  await page.getByRole('button', { name: 'Send request' }).click()

  await expect(page.getByRole('dialog', { name: 'Request a feature' })).toHaveCount(0)
  await expect(page).toHaveURL('/app/events')

  const event = await latestFeatureRequest(page)
  expect(event?.properties).toMatchObject({
    request: 'Add a red-light observing mode',
    requestLength: 30,
    email: 'observer@example.com',
    signedIn: true,
    source: 'feedback_dock',
    path: '/app/events',
    route: '/app/events',
  })
  expect(event?.properties?.$set).toMatchObject({ email: 'observer@example.com', signedIn: true })
})

test('signed-in mobile user submits a feature request without leaving the app', async ({ page }) => {
  await seedSignedInUser(page, { email: 'mobile@example.com' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/events')
  await captureAnalytics(page)

  await page.getByRole('button', { name: 'Request feature' }).click()
  await expect(page.getByRole('dialog', { name: 'Request a feature' })).toBeVisible()
  await page.getByLabel('Feature idea').fill('Add an offline stargazing checklist')
  await expect(page.getByLabel('Email for follow-up')).toHaveCount(0)
  await page.getByRole('button', { name: 'Send request' }).click()

  await expect(page.getByRole('dialog', { name: 'Request a feature' })).toHaveCount(0)
  await expect(page).toHaveURL('/app/events')

  const event = await latestFeatureRequest(page)
  expect(event?.properties).toMatchObject({
    request: 'Add an offline stargazing checklist',
    requestLength: 35,
    email: 'mobile@example.com',
    signedIn: true,
    source: 'feedback_dock',
    path: '/app/events',
    route: '/app/events',
  })
  expect(event?.properties?.$set).toMatchObject({ email: 'mobile@example.com', signedIn: true })
})

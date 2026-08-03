import { test, expect, type Page } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

declare global {
  interface Window {
    __atlasCapturedEvents: Array<{ name: string; properties?: Record<string, unknown> }>
  }
}

async function captureAnalytics(page: Page) {
  await page.evaluate(() => {
    window.__atlasCapturedEvents = []
    window.addEventListener('atlas:analytics-event', (event) => {
      window.__atlasCapturedEvents.push((event as CustomEvent).detail)
    })
  })
}

async function dispatchSurveyTrigger(page: Page, name = 'Submitted reminder feedback') {
  await page.evaluate((eventName) => {
    window.dispatchEvent(new CustomEvent('atlas:analytics-event', { detail: { name: eventName } }))
  }, name)
}

async function latestEvent(page: Page, name: string) {
  return page.evaluate((eventName) => window.__atlasCapturedEvents.findLast((event) => event.name === eventName), name)
}

test('contextual micro-survey submits one-tap answer with optional note', async ({ page }) => {
  await seedSignedInUser(page)
  await page.goto('/app/today')
  await captureAnalytics(page)

  await dispatchSurveyTrigger(page)
  await expect(page.getByRole('dialog', { name: 'Was that reminder/check-in useful?' })).toBeVisible()
  await page.getByLabel('Note').fill('Clear and timely')
  await page.getByRole('button', { name: 'Somewhat' }).click()

  await expect(page.getByRole('dialog', { name: 'Was that reminder/check-in useful?' })).toHaveCount(0)
  await expect(page.evaluate(() => localStorage.getItem('atlas-feedback-micro-state:reminder_feedback_helpfulness'))).resolves.toBe('submitted')

  const event = await latestEvent(page, 'Micro survey submitted')
  expect(event?.properties).toMatchObject({
    surveyId: 'reminder_feedback_helpfulness',
    answer: 'Somewhat',
    note: 'Clear and timely',
    source: 'feedback_dock',
  })
})

test('contextual micro-survey is locally throttled after dismissal', async ({ page }) => {
  await seedSignedInUser(page)
  await page.goto('/app/today')
  await captureAnalytics(page)

  await dispatchSurveyTrigger(page)
  await expect(page.getByRole('dialog', { name: 'Was that reminder/check-in useful?' })).toBeVisible()
  await page.getByRole('button', { name: 'Close feedback panel' }).click()

  await expect(page.getByRole('dialog', { name: 'Was that reminder/check-in useful?' })).toHaveCount(0)
  await expect(page.evaluate(() => localStorage.getItem('atlas-feedback-micro-state:reminder_feedback_helpfulness'))).resolves.toBe('dismissed')

  await dispatchSurveyTrigger(page)
  await expect(page.getByRole('dialog', { name: 'Was that reminder/check-in useful?' })).toHaveCount(0)

  const event = await latestEvent(page, 'Micro survey dismissed')
  expect(event?.properties).toMatchObject({ surveyId: 'reminder_feedback_helpfulness' })
})

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

// With PostHog survey IDs configured (VITE_POSTHOG_SURVEY_*_ID, as in a normal
// .env) FeedbackDock reports `survey sent` / `survey dismissed` keyed by
// $survey_id; without them it falls back to the legacy event names. Accept both
// so the spec does not depend on the developer's env file.
async function latestEvent(page: Page, ...names: string[]) {
  return page.evaluate((eventNames) => window.__atlasCapturedEvents.findLast((event) => eventNames.includes(event.name)), names)
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

  const event = await latestEvent(page, 'Micro survey submitted', 'survey sent')
  expect(event?.properties).toMatchObject(
    event?.name === 'survey sent'
      ? { surveyKey: 'reminder_feedback_helpfulness', $survey_response: 'Somewhat', note: 'Clear and timely', source: 'feedback_dock' }
      : { surveyId: 'reminder_feedback_helpfulness', answer: 'Somewhat', note: 'Clear and timely', source: 'feedback_dock' },
  )
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

  const event = await latestEvent(page, 'Micro survey dismissed', 'survey dismissed')
  expect(event?.properties).toMatchObject(
    event?.name === 'survey dismissed' ? { surveyKey: 'reminder_feedback_helpfulness' } : { surveyId: 'reminder_feedback_helpfulness' },
  )
})

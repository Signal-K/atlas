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

async function dispatchMeaningfulActivity(page: Page, count: number, name = 'first_plan_equipment_selected') {
  for (let i = 0; i < count; i += 1) {
    await page.evaluate((eventName) => {
      window.dispatchEvent(new CustomEvent('atlas:analytics-event', { detail: { name: eventName } }))
    }, name)
  }
}

async function latestEvent(page: Page, name: string) {
  return page.evaluate((eventName) => window.__atlasCapturedEvents.findLast((event) => event.name === eventName), name)
}

// /app/tonight redirects to HubPage, which itself fires a real, once-only
// "Tonight plan generation succeeded" event on mount (a MEANINGFUL_EVENTS
// entry) -- FeedbackDock also treats that as the ASV-26 postplan-survey
// trigger and, being first, would otherwise claim its single `mode` slot
// and count towards the NPS activity threshold before this suite's own
// synthetic events run. Pre-dismiss postplan/wtp so `mode` stays free for
// NPS, and wait for that real load to finish and zero the activity counter
// it bumped, so each test starts from a clean, deterministic baseline.
function skipOtherFeedbackSurveys(page: Page) {
  return page.addInitScript(() => {
    window.localStorage.setItem('atlas-feedback-postplan-state', 'dismissed')
    window.localStorage.setItem('atlas-feedback-wtp-state', 'dismissed')
  })
}

async function gotoTonightWithCleanActivityBaseline(page: Page) {
  await page.goto('/app/tonight')
  await expect(page.getByRole('heading', { name: /Worth a look tonight\.|Tonight is live|Hold for a better window/ })).toBeVisible()
  await page.evaluate(() => window.localStorage.setItem('atlas-feedback-activity-count', '0'))
}

test('NPS prompt appears only after meaningful activity threshold and submits structured analytics', async ({ page }) => {
  await seedSignedInUser(page)
  await skipOtherFeedbackSurveys(page)
  await gotoTonightWithCleanActivityBaseline(page)
  await captureAnalytics(page)

  await expect(page.getByRole('dialog', { name: 'Quick score' })).toHaveCount(0)
  await dispatchMeaningfulActivity(page, 3)
  await expect(page.getByRole('dialog', { name: 'Quick score' })).toHaveCount(0)

  await dispatchMeaningfulActivity(page, 1)
  const dialog = page.getByRole('dialog', { name: 'Quick score' })
  await expect(dialog).toBeVisible()
  // Scoped to the dialog -- the background events list can contain buttons
  // whose accessible name includes a "9" from a event time (e.g. "9:00 PM"),
  // which would otherwise collide with the score-9 button in strict mode.
  await dialog.getByRole('button', { name: '9', exact: true }).click()
  await page.getByLabel('Reason').fill('The timing guidance is useful')
  await page.getByRole('button', { name: 'Send' }).click()

  await expect(page.getByRole('dialog', { name: 'Quick score' })).toHaveCount(0)
  await expect(page.evaluate(() => localStorage.getItem('atlas-feedback-nps-state'))).resolves.toBe('submitted')

  const event = await latestEvent(page, 'NPS survey submitted')
  expect(event?.properties).toMatchObject({
    score: 9,
    reason: 'The timing guidance is useful',
    trigger: 'first_plan_equipment_selected',
    activityCount: 4,
    source: 'feedback_dock',
  })
})

test('NPS dismissal is locally throttled', async ({ page }) => {
  await seedSignedInUser(page)
  await skipOtherFeedbackSurveys(page)
  await gotoTonightWithCleanActivityBaseline(page)
  await captureAnalytics(page)

  await dispatchMeaningfulActivity(page, 4)
  await expect(page.getByRole('dialog', { name: 'Quick score' })).toBeVisible()
  await page.getByRole('button', { name: 'Close feedback panel' }).click()

  await expect(page.getByRole('dialog', { name: 'Quick score' })).toHaveCount(0)
  await expect(page.evaluate(() => localStorage.getItem('atlas-feedback-nps-dismissed-at'))).resolves.toBeTruthy()

  await dispatchMeaningfulActivity(page, 4)
  await expect(page.getByRole('dialog', { name: 'Quick score' })).toHaveCount(0)

  const event = await latestEvent(page, 'NPS prompt dismissed')
  expect(event?.properties).toMatchObject({ activityCount: 4 })
})

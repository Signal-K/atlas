import { expect, test, type Page } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

// ASV-116: surveys were shown 14 times in 60 days, dismissed 1-20s later, never
// answered. They now wait for a quiet moment and fire on a completed outcome.

const REMINDER_QUESTION = 'Was that reminder/check-in useful?'
const TARGET_QUESTION = 'Did this help you decide what to look for?'

async function trigger(page: Page, name: string) {
  await page.evaluate((eventName) => {
    window.dispatchEvent(new CustomEvent('atlas:analytics-event', { detail: { name: eventName } }))
  }, name)
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedSignedInUser(page)
  await page.goto('/app/hub')
})

test('a survey does not pop up the instant its trigger fires, but does after a quiet moment', async ({ page }) => {
  await trigger(page, 'Submitted reminder feedback')
  await page.waitForTimeout(800)
  await expect(page.getByRole('dialog', { name: REMINDER_QUESTION })).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: REMINDER_QUESTION })).toBeVisible({ timeout: 5_000 })
})

test('tapping a plan target (mid-flow) no longer opens the target survey; finishing the guided look does', async ({ page }) => {
  await trigger(page, 'first_plan_target_tapped')
  await page.waitForTimeout(3_500)
  await expect(page.getByRole('dialog', { name: TARGET_QUESTION })).toHaveCount(0)

  await trigger(page, 'Tour completed')
  await expect(page.getByRole('dialog', { name: TARGET_QUESTION })).toBeVisible({ timeout: 6_000 })
})

test('a queued survey waits while the navigation drawer is open', async ({ page }) => {
  await page.getByRole('button', { name: /menu/i }).first().click()
  await expect(page.locator('.az-nav-drawer')).toBeVisible()

  await trigger(page, 'Submitted reminder feedback')
  await page.waitForTimeout(3_500)
  await expect(page.getByRole('dialog', { name: REMINDER_QUESTION })).toHaveCount(0)

  await page.getByRole('button', { name: 'Close menu' }).click()
  await expect(page.getByRole('dialog', { name: REMINDER_QUESTION })).toBeVisible({ timeout: 6_000 })
})

test('the post-plan survey does not open on first Hub load, only after a completed outcome', async ({ page }) => {
  const POSTPLAN_QUESTION = 'Quick question about tonight'
  // Let the real first-load plan generation event fire and settle.
  await page.waitForTimeout(4_500)
  await expect(page.getByRole('dialog', { name: POSTPLAN_QUESTION })).toHaveCount(0)

  await page.evaluate(() => window.localStorage.setItem('atlas-feedback-plan-seen', '1'))
  await trigger(page, 'Logged observation')
  await expect(page.getByRole('dialog', { name: POSTPLAN_QUESTION })).toBeVisible({ timeout: 6_000 })
})

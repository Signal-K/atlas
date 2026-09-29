import { test, expect } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

test.describe('feedback dock safety', () => {
  test.beforeEach(async ({ page }) => {
    await seedSignedInUser(page, { onboardingComplete: true, entitled: true })
  })

  test('reserves room for the secondary feedback affordance and defers it to a sheet', async ({ page }) => {
    await page.goto('/app/journal')

    const dock = page.getByRole('button', { name: 'Send feedback' })
    await expect(dock).toBeVisible()
    await expect(page.locator('body')).toHaveClass(/has-feedback-dock/)

    const scrollPadding = await page.locator('.nav-shell-main').evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingBottom))
    expect(scrollPadding).toBeGreaterThanOrEqual(80)

    await page.getByRole('button', { name: "Log tonight's session" }).click()
    await expect(page.locator('.az-sheet')).toBeVisible()
    await expect(dock).toBeHidden()

    await page.getByRole('button', { name: /close/i }).first().click()
    await expect(dock).toBeVisible()
  })
})

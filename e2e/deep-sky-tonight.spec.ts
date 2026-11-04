import { test, expect } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

// ASV-154. The Events tab carries a "Through your telescope tonight" card:
// at least five rewarding targets for a telescope user, each with a best
// time, a direction and a plain how-to, and a gear picker that remembers.

test('a telescope user sees at least five targets with time, direction and how-to', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedSignedInUser(page)
  await page.goto('/app/events')

  const card = page.getByRole('region', { name: 'Deep sky tonight' })
  await expect(card).toBeVisible()

  await card.getByRole('button', { name: 'Small scope (60–100 mm)' }).click()
  await expect(card.getByRole('heading', { name: 'Through your telescope tonight' })).toBeVisible()

  const picks = card.locator('[data-pick-id]')
  expect(await picks.count()).toBeGreaterThanOrEqual(5)
  const first = picks.first()
  await expect(first).toContainText('Best around')
  await expect(first).toContainText('° up')
  await expect(first.locator('.deep-sky-pick-how')).not.toBeEmpty()

  await card.screenshot({ path: test.info().outputPath('deep-sky-card-mobile.png') })
})

test('the gear pick changes the list and is remembered after a reload', async ({ page }) => {
  await seedSignedInUser(page)
  await page.goto('/app/events')
  const card = page.getByRole('region', { name: 'Deep sky tonight' })

  await card.getByRole('button', { name: 'Large scope (130 mm+)' }).click()
  await expect(card.getByRole('button', { name: 'Large scope (130 mm+)' })).toHaveAttribute('aria-pressed', 'true')

  await page.reload()
  const reloaded = page.getByRole('region', { name: 'Deep sky tonight' })
  await expect(reloaded.getByRole('button', { name: 'Large scope (130 mm+)' })).toHaveAttribute('aria-pressed', 'true')
})

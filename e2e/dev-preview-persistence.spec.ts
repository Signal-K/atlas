import { expect, test } from '@playwright/test'

// ASV-115: the dev "Preview signed-in" user lived in memory only, so every full
// page load dropped it and gated deep links showed the sign-in form.

test('dev preview survives a reload and deep links, and Exit preview clears it', async ({ page }) => {
  await page.goto('/app/profile')
  await expect(page.getByRole('heading', { name: /Create your free account|Welcome back/ })).toBeVisible()

  await page.getByRole('button', { name: 'Preview signed-in' }).click()
  await expect(page.getByRole('heading', { name: 'You', exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'You', exact: true })).toBeVisible()
  await page.goto('/app/planner')
  // Planner is account-gated and then Sky Pass-gated. Reaching the paywall
  // (not the auth gate) is what shows the preview session survived the hop.
  await expect(page.getByRole('heading', { name: 'Plan the whole trip, not just tonight' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Create your free account|Welcome back/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Exit preview' }).click()
  await page.reload()
  await expect(page.getByRole('heading', { name: /Create your free account|Welcome back/ })).toBeVisible()
})

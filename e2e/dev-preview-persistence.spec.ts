import { expect, test } from '@playwright/test'

// ASV-115: the dev "Preview signed-in" user lived in memory only, so every full
// page load dropped it and gated deep links showed the sign-in form.

test('dev preview survives a reload and deep links, and Exit preview clears it', async ({ page }) => {
  await page.goto('/app/calendar')
  await expect(page.getByRole('heading', { name: /Create your free account|Welcome back/ })).toBeVisible()

  await page.getByRole('button', { name: 'Preview signed-in' }).click()
  await expect(page.getByRole('heading', { name: 'Calendar', exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Calendar', exact: true })).toBeVisible()
  await page.goto('/app/journal')
  await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Exit preview' }).click()
  await page.reload()
  await expect(page.getByRole('heading', { name: /Create your free account|Welcome back/ })).toBeVisible()
})

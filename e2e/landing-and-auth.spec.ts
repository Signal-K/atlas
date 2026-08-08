import { expect, test } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

test('landing page renders and links into the app gate', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /what can i see in the sky tonight/i })).toBeVisible()

  await page.getByRole('button', { name: /get started/i }).first().click()
  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByRole('heading', { name: /sign in to atlas/i })).toBeVisible()
})

test('sign-in form switches to sign-up mode', async ({ page }) => {
  await page.goto('/app')
  await page.getByRole('button', { name: /need an account/i }).click()
  await expect(page.getByRole('button', { name: /create account/i })).toBeVisible()
})

test('a signed-in session shows the placeholder gate', async ({ page }) => {
  await seedSignedInUser(page, { email: 'atlas-e2e@example.com' })
  await page.goto('/app')
  await expect(page.getByRole('heading', { name: /you're signed in/i })).toBeVisible()
  await expect(page.getByText('atlas-e2e@example.com')).toBeVisible()
})

import { expect, test } from '@playwright/test'
import PocketBase from 'pocketbase'

const testEmail = process.env.ATLAS_E2E_EMAIL ?? `journey-${Date.now()}@atlas-e2e.test`
const initialPassword = process.env.ATLAS_E2E_PASSWORD ?? 'Atlas-e2e-password-123!'
const changedPassword = 'Atlas-e2e-password-456!'

test.describe.configure({ mode: 'serial' })

test('creates an isolated account and exercises the complete signed-in shell', async ({ page }) => {
  await page.goto('/app')
  await page.getByRole('button', { name: /need an account/i }).click()
  await page.getByLabel('Email').fill(testEmail)
  await page.getByLabel('Password').fill(initialPassword)
  await page.getByRole('button', { name: /create account/i }).click()

  await expect(page).toHaveURL(/\/app\/events$/)
  await expect(page.getByRole('heading', { name: /^events$/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /view past events/i })).toBeVisible()

  for (const destination of ['Calendar', 'Conditions', 'Account']) {
    await page.getByRole('link', { name: destination, exact: true }).click()
    await expect(page.getByRole('heading', { name: new RegExp(`^${destination}$`, 'i') })).toBeVisible()
  }

  await page.getByRole('button', { name: /change password/i }).click()
  await page.getByPlaceholder('Current password').fill(initialPassword)
  await page.getByPlaceholder('New password').fill(changedPassword)
  await page.getByPlaceholder('Confirm new password').fill(changedPassword)
  await page.getByRole('button', { name: /update password/i }).click()
  await expect(page.getByText('Password updated.')).toBeVisible()

  await page.getByRole('button', { name: /sign out/i }).click()
  await expect(page.getByRole('heading', { name: /sign in to atlas/i })).toBeVisible()
  await page.getByLabel('Email').fill(testEmail)
  await page.getByLabel('Password').fill(changedPassword)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await expect(page).toHaveURL(/\/app\/events$/)

  // The app's account deletion UI is deliberately left for the cleanup
  // execution. That lets the migration/execution prove it removes data after
  // a failed test as well as after a successful run.
  await page.getByRole('link', { name: 'Account', exact: true }).click()
  await expect(page.getByText(testEmail)).toBeVisible()
})

test('cleanup execution can see the account before it is purged', async () => {
  const adminUrl = process.env.ATLAS_E2E_PB_URL ?? process.env.VITE_PB_URL
  const adminEmail = process.env.ATLAS_E2E_ADMIN_EMAIL
  const adminPassword = process.env.ATLAS_E2E_ADMIN_PASSWORD
  test.skip(!adminUrl || !adminEmail || !adminPassword, 'requires the isolated shared PocketBase admin')

  const pb = new PocketBase(adminUrl!)
  await pb.admins.authWithPassword(adminEmail!, adminPassword!)
  const user = await pb.collection('users').getFirstListItem(`email = "${testEmail}"`)
  expect(user.email).toBe(testEmail)
})

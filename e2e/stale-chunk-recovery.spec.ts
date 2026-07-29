import { expect, test } from '@playwright/test'

test('recovers once from a stale Vite chunk and never leaves a blank screen', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'What can I see in the sky tonight?' })).toBeVisible()

  await page
    .evaluate(() => {
      const staleChunk = document.createElement('script')
      staleChunk.type = 'module'
      staleChunk.src = '/assets/removed-by-a-new-deployment.js'
      document.head.append(staleChunk)
    })
    .catch(() => {
      // The recovery intentionally replaces the document while evaluate is
      // in flight, so Chromium may destroy this execution context first.
    })

  await page.waitForURL(/_atlas_recovery=/)
  await expect(page.getByRole('heading', { name: 'What can I see in the sky tonight?' })).toBeVisible()

  await page.evaluate(() => {
    const staleChunk = document.createElement('script')
    staleChunk.type = 'module'
    staleChunk.src = '/assets/removed-by-a-new-deployment.js'
    document.head.append(staleChunk)
  })

  await expect(page.getByRole('heading', { name: 'Atlas needs a fresh copy' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reload latest version' })).toBeVisible()
})

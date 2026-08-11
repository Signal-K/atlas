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

test('recovers when Chromium accepts an empty stylesheet response without emitting an asset error', async ({ page }) => {
  // This mirrors the production symptom: JavaScript runs, but the stylesheet
  // is silently missing and the page paints as native browser HTML. A 200
  // response keeps the link's error event from firing, so the revision marker
  // is the only reliable way to detect it.
  await page.goto('/')
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--atlas-style-revision', 'missing')
    window.dispatchEvent(new Event('load'))
  })
  await page.waitForURL(/_atlas_recovery=/)
})

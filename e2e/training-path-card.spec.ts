import { test, expect } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

// ASV-89. The Hub path card is derived from interests + experience + chips and
// ticks steps from the same rows the progress projector reads.

async function mockWeather(page: import('@playwright/test').Page) {
  await page.route('https://api.open-meteo.com/**', async (route) => {
    const time = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() + i)
      return d.toISOString().slice(0, 10)
    })
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        timezone: 'Europe/London',
        daily: { time, cloud_cover_mean: Array(7).fill(20), precipitation_probability_mean: Array(7).fill(5) },
      }),
    })
  })
}

test('editing interests regenerates the path and a matching check-in ticks a step', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockWeather(page)
  await seedSignedInUser(page)
  await page.goto('/app/hub')

  const card = page.getByRole('region', { name: 'Your training path' })
  await expect(card).toContainText('Next step on your path')
  await expect(card.locator('[data-path-step="first-night"]')).toHaveAttribute('data-state', 'open')
  await expect(card.locator('[data-path-step^="category-"]')).toContainText('planets')

  await card.getByRole('button', { name: 'Edit path' }).click()
  await page.getByRole('button', { name: 'Meteors & fireballs' }).click()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(card.locator('[data-path-step^="category-"]')).toContainText('meteors')

  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('atlas')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const idb = open.result
          const tx = idb.transaction(['observations', 'skyEvents'], 'readwrite')
          tx.objectStore('skyEvents').put({ id: 'e2e-meteor', kind: 'meteor_shower', title: 'Orionids', target: 'Orionids', startsAt: new Date().toISOString() })
          tx.objectStore('observations').put({ id: 'e2e-path-entry', userId: 'e2e-user', observedAt: new Date().toISOString(), eventId: 'e2e-meteor' })
          tx.oncomplete = () => {
            idb.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
  )
  await page.reload()

  await expect(card.locator('[data-path-step="first-night"]')).toHaveAttribute('data-state', 'done')
  await expect(card.locator('[data-path-step^="category-"]')).toHaveAttribute('data-state', 'done')
})

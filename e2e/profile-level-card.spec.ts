import { test, expect } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

// ASV-84. The Profile level card projects progress from rows Atlas already
// stores (ASV-83), so the spec seeds a diary entry straight into Dexie.

test('level card shows the empty state, then points after a qualifying check-in', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedSignedInUser(page)
  await page.goto('/app/profile')

  const card = page.getByRole('region', { name: 'Your level' })
  await expect(card).toContainText('Log tonight to earn your first points.')
  await expect(card.locator('[data-milestone="first-community-night"]')).toHaveAttribute('data-state', 'locked')

  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('atlas')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const idb = open.result
          const tx = idb.transaction('observations', 'readwrite')
          tx.objectStore('observations').put({
            id: 'e2e-level-card-entry',
            userId: 'e2e-user',
            observedAt: new Date().toISOString(),
          })
          tx.oncomplete = () => {
            idb.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
  )

  await page.reload()
  await expect(card).toContainText('Level 1')
  await expect(card).toContainText('10 pts')
  await expect(card.locator('[data-milestone="first-check-in"]')).toHaveAttribute('data-state', 'achieved')
  await expect(card.locator('[data-milestone="first-community-night"]')).toHaveAttribute('data-state', 'locked')
})

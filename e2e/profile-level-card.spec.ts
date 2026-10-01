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
  await expect(card.locator('[data-milestone="first-community-night"]')).toHaveAttribute('data-state', 'open')

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
  await expect(card.locator('[data-milestone="first-community-night"]')).toHaveAttribute('data-state', 'open')
})

test('observing meter lists typed sky-event check-ins on their own line', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedSignedInUser(page)
  await page.goto('/app/profile')
  await expect(page.getByRole('region', { name: 'Your level' })).toBeVisible()

  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('atlas')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const idb = open.result
          const tx = idb.transaction(['observations', 'skyEvents'], 'readwrite')
          tx.objectStore('skyEvents').put({ id: 'e2e-conjunction', kind: 'conjunction', title: 'Moon–Jupiter', target: 'Jupiter', startsAt: new Date().toISOString() })
          tx.objectStore('observations').put({ id: 'e2e-typed-entry', userId: 'e2e-user', observedAt: new Date().toISOString(), eventId: 'e2e-conjunction' })
          tx.oncomplete = () => {
            idb.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
  )

  await page.reload()
  const card = page.getByRole('region', { name: 'Your level' })
  await expect(card).toContainText('15 pts')
  await expect(card.locator('[data-observing-kind="conjunction"]')).toContainText('Conjunctions')
})

test('following camera recipe advice adds the photography bonus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedSignedInUser(page)
  await page.addInitScript(() => {
    localStorage.setItem(
      'atlas-recipe-opens',
      JSON.stringify([{ recipeKey: 'bright_planet', target: 'Jupiter', openedAt: '2000-01-01T00:00:00.000Z' }]),
    )
  })
  await page.goto('/app/profile')
  await expect(page.getByRole('region', { name: 'Your level' })).toBeVisible()

  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('atlas')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const idb = open.result
          const tx = idb.transaction('observations', 'readwrite')
          tx.objectStore('observations').put({
            id: 'e2e-advice-entry',
            userId: 'e2e-user',
            observedAt: new Date().toISOString(),
            targetName: 'Jupiter',
            cameraRecipeUsed: 'bright_planet',
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
  // 10 for the night + 5 typed (bright_planet recipe resolves to a planet) + 12 for following the recipe.
  await expect(page.getByRole('region', { name: 'Your level' })).toContainText('27 pts')
})

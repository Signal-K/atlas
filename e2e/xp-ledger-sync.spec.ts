import { test, expect, type Page } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

// ASV-93, default suite (no real PocketBase needed). The ledger endpoint is
// stubbed with the collection's real contract -- owner-scoped list, and a
// unique (user, action, source_id) key that rejects a second create with a 400
// -- so this proves the client never double-writes and survives a rejection.
// The same flow against a real PocketBase is in pocketbase-write-actions.spec.ts.

interface LedgerRow {
  action: string
  source_id: string
  skill: string
  points: number
  user: string
}

async function stubLedger(page: Page, store: LedgerRow[], opts: { creates: { n: number }; failNextWith?: { status: number } }) {
  await page.route('**/api/collections/atlas_xp_ledger/records**', async (route) => {
    const request = route.request()
    if (request.method() === 'GET') {
      await route.fulfill({
        json: { page: 1, perPage: 500, totalItems: store.length, totalPages: 1, items: store.map((row, index) => ({ id: `r${index}`, ...row })) },
      })
      return
    }
    opts.creates.n += 1
    const body = request.postDataJSON() as LedgerRow
    if (opts.failNextWith) {
      const status = opts.failNextWith.status
      opts.failNextWith = undefined
      await route.fulfill({ status, json: { message: 'boom', data: {} } })
      return
    }
    if (store.some((row) => row.action === body.action && row.source_id === body.source_id)) {
      await route.fulfill({ status: 400, json: { message: 'Failed to create record.', data: { source_id: { code: 'validation_not_unique', message: 'Value must be unique' } } } })
      return
    }
    store.push(body)
    await route.fulfill({ json: { id: `r${store.length}`, ...body } })
  })
}

async function logSkyNight(page: Page, date: string) {
  await page.goto('/app/journal?sky-night=1')
  await page.getByPlaceholder('e.g. Tallinn').fill('Tallinn')
  await page.locator('input[type="date"]').fill(date)
  await page.getByRole('button', { name: 'Log sky night' }).click()
  await expect(page.getByText(/Sky night logged/)).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedSignedInUser(page)
})

test('a save appends its award once and a repeat save adds nothing', async ({ page }) => {
  const store: LedgerRow[] = []
  const opts = { creates: { n: 0 } }
  await stubLedger(page, store, opts)

  await logSkyNight(page, '2026-09-20')
  await expect.poll(() => store.length, { timeout: 15_000 }).toBe(1)
  expect(store[0]).toMatchObject({ action: 'community_night', source_id: '2026-09-20', skill: 'community', points: 25, user: 'e2e-user' })

  // Same civil date again: the projector already counted it, so the ledger
  // sees no new award and the client must not even attempt a create.
  const createsBefore = opts.creates.n
  await logSkyNight(page, '2026-09-20')
  await page.waitForTimeout(500)
  expect(opts.creates.n).toBe(createsBefore)
  expect(store).toHaveLength(1)

  // A different date is a new key: exactly one more row.
  await logSkyNight(page, '2026-09-21')
  await expect.poll(() => store.length, { timeout: 15_000 }).toBe(2)
})

test('rows already in the ledger are backfilled around, not duplicated', async ({ page }) => {
  const store: LedgerRow[] = [{ action: 'community_night', source_id: '2026-09-20', skill: 'community', points: 25, user: 'e2e-user' }]
  const opts = { creates: { n: 0 } }
  await stubLedger(page, store, opts)

  await logSkyNight(page, '2026-09-20')
  await page.waitForTimeout(500)
  expect(opts.creates.n).toBe(0)
  expect(store).toHaveLength(1)
})

test('a failing ledger write never blocks the save and is retried on the next one', async ({ page }) => {
  const store: LedgerRow[] = []
  const opts: { creates: { n: number }; failNextWith?: { status: number } } = { creates: { n: 0 }, failNextWith: { status: 500 } }
  await stubLedger(page, store, opts)

  await logSkyNight(page, '2026-09-20') // toast still appears; the 500 is swallowed
  await expect.poll(() => opts.creates.n, { timeout: 15_000 }).toBe(1)
  expect(store).toHaveLength(0)

  await logSkyNight(page, '2026-09-21') // next save re-projects and appends both awards
  await expect.poll(() => store.length, { timeout: 15_000 }).toBe(2)
  expect(store.map((row) => row.source_id).sort()).toEqual(['2026-09-20', '2026-09-21'])
})

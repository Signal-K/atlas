import assert from 'node:assert/strict'
import test from 'node:test'

import { projectProgress } from '../src/lib/progress.ts'
import { ledgerKey, ledgerTotals, missingAwards, syncAwards, toLedgerRow } from '../src/lib/xpLedgerCore.ts'

// ASV-93. The ledger stores exactly the projector's awards, so these tests pin
// the two "done when" rules: retries never duplicate, and backfilled totals
// equal the projector for each user.

function observation(id, observedAt, extra = {}) {
  return { id, userId: 'user-1', observedAt, ...extra }
}

const TRIP = {
  id: 'trip-1',
  startDate: '2026-10-01',
  endDate: '2026-10-09',
  legs: [
    { id: 'leg-a', cityName: 'Tallinn', startDate: '2026-10-01', endDate: '2026-10-03' },
    { id: 'leg-b', cityName: 'Riga', startDate: '2026-10-04', endDate: '2026-10-06' },
    { id: 'leg-c', cityName: 'Vilnius', startDate: '2026-10-07', endDate: '2026-10-09' },
  ],
  equipment: [],
  interests: [],
  guides: {},
}

const BUSY_USER = {
  observations: [
    observation('o1', '2026-10-01T20:00:00.000Z', { photoR2Key: 'k1', isPublic: true, eventId: 'e1' }),
    observation('o2', '2026-10-01T22:00:00.000Z', { photoR2Key: 'k2' }),
    observation('o3', '2026-10-02T20:00:00.000Z', { targetName: 'Jupiter', cameraRecipeUsed: 'bright_planet' }),
    observation('pending', '2026-10-03T20:00:00.000Z', { reviewStatus: 'pending', photoR2Key: 'k3' }),
    observation('sky', '2026-10-05T12:00:00.000Z', { communityNightHost: 'Tallinn' }),
  ],
  tripPlan: TRIP,
  firstTourBadge: 'first_light',
  sightingKinds: { o1: 'conjunction', o3: 'planet_event' },
  recipeOpens: [{ recipeKey: 'bright_planet', target: 'Jupiter', openedAt: '2000-01-01T00:00:00.000Z' }],
}

function memoryClient(initial = []) {
  const rows = new Map(initial.map((row) => [ledgerKey(row.action, row.source_id), row]))
  return {
    rows,
    creates: 0,
    async listKeys() {
      return new Set(rows.keys())
    },
    async create(row) {
      this.creates += 1
      const key = ledgerKey(row.action, row.source_id)
      // Mirrors the collection's unique index.
      if (rows.has(key)) throw { status: 400, response: { data: { source_id: { message: 'Value must be unique' } } } }
      rows.set(key, row)
    },
  }
}

test('awards sum to the projector totals for every skill', () => {
  const summary = projectProgress(BUSY_USER)
  assert.ok(summary.awards.length > 0)
  const totals = ledgerTotals(summary.awards.map(toLedgerRow))
  assert.deepEqual(totals.skills, summary.skills)
  assert.equal(totals.total, summary.totalPoints)
})

test('every award has a distinct (action, sourceId) key', () => {
  const { awards } = projectProgress(BUSY_USER)
  const keys = awards.map((award) => ledgerKey(award.action, award.sourceId))
  assert.equal(new Set(keys).size, keys.length)
})

test('pending-review entries produce no awards', () => {
  const { awards } = projectProgress(BUSY_USER)
  assert.equal(awards.some((award) => award.sourceId === 'pending'), false)
})

test('trip legs are paid per leg after the first, keyed by leg id', () => {
  const { awards } = projectProgress({ observations: [], tripPlan: TRIP })
  assert.deepEqual(
    awards.map((award) => [award.action, award.sourceId, award.points]),
    [['trip_planned', 'trip-1', 20], ['trip_leg', 'leg-b', 5], ['trip_leg', 'leg-c', 5]],
  )
})

test('retrying a sync creates no second row', async () => {
  const { awards } = projectProgress(BUSY_USER)
  const client = memoryClient()
  const first = await syncAwards(awards, client)
  const second = await syncAwards(awards, client)
  assert.equal(first, awards.length)
  assert.equal(second, 0)
  assert.equal(client.rows.size, awards.length)
})

test('backfill appends only what is missing and totals match the projector', async () => {
  const summary = projectProgress(BUSY_USER)
  // The ledger already holds the first two awards from earlier saves.
  const client = memoryClient(summary.awards.slice(0, 2).map(toLedgerRow))
  const created = await syncAwards(summary.awards, client)
  assert.equal(created, summary.awards.length - 2)
  const totals = ledgerTotals([...client.rows.values()])
  assert.equal(totals.total, summary.totalPoints)
  assert.deepEqual(totals.skills, summary.skills)
})

test('a unique-index rejection from a racing writer is treated as already recorded', async () => {
  const { awards } = projectProgress({ observations: [observation('a', '2026-10-01T20:00:00.000Z')] })
  const client = memoryClient()
  // listKeys sees an empty ledger, then another tab writes before our create.
  client.listKeys = async () => new Set()
  client.rows.set(ledgerKey(awards[0].action, awards[0].sourceId), toLedgerRow(awards[0]))
  assert.equal(await syncAwards(awards, client), 0)
})

test('a non-conflict failure is not swallowed', async () => {
  const { awards } = projectProgress({ observations: [observation('a', '2026-10-01T20:00:00.000Z')] })
  const client = memoryClient()
  client.create = async () => {
    throw { status: 500 }
  }
  await assert.rejects(() => syncAwards(awards, client))
})

test('later progress only appends: earlier rows are never rewritten', () => {
  const before = projectProgress({ observations: [observation('a', '2026-10-01T20:00:00.000Z')] })
  const after = projectProgress({ observations: [observation('a', '2026-10-01T20:00:00.000Z'), observation('b', '2026-10-02T20:00:00.000Z')] })
  const held = new Set(before.awards.map((award) => ledgerKey(award.action, award.sourceId)))
  const todo = missingAwards(after.awards, held)
  assert.deepEqual(todo.map((award) => award.sourceId), ['2026-10-02'])
})

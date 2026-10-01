import { pb } from './pocketbase'
import { db } from './db'
import { projectProgress } from './progress'
import { resolveSightingKinds } from './progressSnapshot'
import { getRecipeOpens } from './recipeOpens'
import { getActiveTripPlan } from './tripPlans'
import { ledgerKey, syncAwards } from './xpLedgerCore'
import type { LedgerClient } from './xpLedgerCore'

const COLLECTION = 'atlas_xp_ledger'

function pocketBaseClient(userId: string): LedgerClient {
  return {
    async listKeys() {
      const rows = await pb.collection(COLLECTION).getFullList({ filter: pb.filter('user = {:user}', { user: userId }), fields: 'action,source_id' })
      return new Set(rows.map((row) => ledgerKey(String(row.action), String(row.source_id))))
    },
    async create(row) {
      await pb.collection(COLLECTION).create({ user: userId, ...row })
    },
  }
}

let inFlight: Promise<void> | null = null
let rerun = false

/**
 * Re-projects this device's progress and appends any awards the account's
 * ledger is missing. Best-effort and silent: a failed write must never block a
 * save, and the next save (or sign-in) simply retries, because the ledger is
 * derived from rows that still exist.
 *
 * Coalesced: calls made while a sync is running collapse into one more pass,
 * so a burst of saves cannot fan out into concurrent writers.
 */
export function syncXpLedgerSoon(): Promise<void> {
  if (inFlight) {
    rerun = true
    return inFlight
  }
  inFlight = (async () => {
    do {
      rerun = false
      try {
        await runSync()
      } catch {
        // Offline, signed out or collection absent: retried on the next save.
      }
    } while (rerun)
  })().finally(() => {
    inFlight = null
  })
  return inFlight
}

async function runSync(): Promise<void> {
  const userId = pb.authStore.record?.id as string | undefined
  if (!userId || !pb.authStore.isValid || !navigator.onLine) return
  const observations = await db.observations.where('userId').equals(userId).toArray()
  const tripPlan = await getActiveTripPlan().catch(() => null)
  const summary = projectProgress({
    observations,
    tripPlan,
    firstTourBadge: pb.authStore.record?.first_tour_badge === 'first_light' ? 'first_light' : null,
    sightingKinds: await resolveSightingKinds(observations),
    recipeOpens: getRecipeOpens(),
  })
  await syncAwards(summary.awards, pocketBaseClient(userId))
}

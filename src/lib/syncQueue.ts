import { db, type SyncQueueItem } from './db'
import { pb } from './pocketbase'
import { ClientResponseError } from 'pocketbase'

// Handlers translate a queued write into the actual PocketBase call for its
// collection. Only implemented for collections that currently enqueue --
// db.ts's SyncQueueItem type covers the full set this table was designed
// for (AT-003); extending this to streaks/observations/camera presets is
// follow-up work, not done here.
const handlers: Partial<Record<SyncQueueItem['collection'], (item: SyncQueueItem) => Promise<void>>> = {
  atlas_favourites: async (item) => {
    await pb.collection('atlas_favourites').create(item.payload as Record<string, unknown>)
  },
  atlas_watchlist: async (item) => {
    await pb.collection('atlas_watchlist').create(item.payload as Record<string, unknown>)
  },
  atlas_tagged_events: async (item) => {
    const entry = await db.taggedEvents.get(item.recordId)
    if (!entry) return
    if (entry.userId !== pb.authStore.record?.id) throw new Error('tag belongs to a different account')
    const collection = pb.collection('atlas_tagged_events')
    let record = await collection.getFirstListItem(pb.filter('user = {:user} && event_id = {:event}', { user: entry.userId, event: entry.eventId }), { requestKey: null }).catch(error => {
      if (error instanceof ClientResponseError && error.status === 404) return null
      throw error
    })
    if (entry.userId !== pb.authStore.record?.id) throw new Error('account changed during tag sync')
    if (entry.deleted) {
      if (record) await collection.delete(record.id)
      const current = await db.taggedEvents.get(entry.id)
      if (current?.deleted && current.taggedAt === entry.taggedAt) await db.taggedEvents.delete(entry.id)
    } else {
      if (!record) record = await collection.create({ user: entry.userId, event_id: entry.eventId, tagged_at: entry.taggedAt })
      if (!record) throw new Error('tag row unavailable')
      await db.taggedEvents.update(entry.id, { remoteId: record.id })
    }
  },
  atlas_observations: async (item) => {
    const entry = await db.observations.get(item.recordId)
    if (!entry || entry.remoteId) return
    if (entry.userId !== pb.authStore.record?.id) throw new Error('observation belongs to a different account')
    const { pushObservation } = await import('./sync')
    const remoteId = await pushObservation(entry)
    if (!remoteId) throw new Error('observation still waiting for a successful sync')
  },
}

// Same shape of check as auth.ts's isExistingAccountError, generalized to
// any field -- a queued create can fail with "already exists" if the first
// attempt actually succeeded slowly (e.g. request completed after its
// caller's catch block already gave up and queued it).
function isAlreadyExistsError(error: unknown): boolean {
  if (!(error instanceof ClientResponseError)) return false
  const fieldErrors = Object.values(error.response?.data ?? {}) as Array<{ code?: string; message?: string }>
  return fieldErrors.some((details) => {
    const code = details?.code?.toLowerCase() ?? ''
    const message = details?.message?.toLowerCase() ?? ''
    return code.includes('unique') || message.includes('already') || message.includes('in use')
  })
}

export async function enqueueSync(
  collection: SyncQueueItem['collection'],
  op: SyncQueueItem['op'],
  recordId: string,
  payload?: unknown,
): Promise<void> {
  await db.syncQueue.add({ collection, op, recordId, payload, queuedAt: new Date().toISOString() })
}

export async function clearQueuedSyncItems(collection: SyncQueueItem['collection'], recordId: string): Promise<void> {
  const rows = await db.syncQueue.where('collection').equals(collection).toArray()
  const matchingIds = rows.filter((row) => row.recordId === recordId).map((row) => row.id).filter((id): id is number => id != null)
  if (matchingIds.length > 0) await db.syncQueue.bulkDelete(matchingIds)
}

export async function enqueueObservationRetry(recordId: string): Promise<void> {
  const rows = await db.syncQueue.where('collection').equals('atlas_observations').toArray()
  if (rows.some((row) => row.recordId === recordId && row.op === 'create')) return
  await enqueueSync('atlas_observations', 'create', recordId)
}

let flushing = false

// Best-effort replay of queued writes, in the order they were queued. Safe
// to call repeatedly/concurrently (no-ops while already running) -- meant
// to be called on app startup and on the browser's `online` event.
export async function flushSyncQueue(): Promise<void> {
  if (flushing) return
  if (!pb.authStore.isValid || !navigator.onLine) return
  flushing = true
  try {
    const items = await db.syncQueue.orderBy('queuedAt').toArray()
    for (const item of items) {
      const handler = handlers[item.collection]
      if (!handler) continue // Not yet supported for replay -- stays queued.
      try {
        const owner = (item.payload as { user?: string } | undefined)?.user
        if (owner && owner !== pb.authStore.record?.id) continue
        await handler(item)
        if (item.id != null) await db.syncQueue.delete(item.id)
      } catch (error) {
        if (isAlreadyExistsError(error) && item.id != null) {
          await db.syncQueue.delete(item.id)
        }
        // Otherwise leave it queued -- retried on the next flush.
      }
    }
  } finally {
    flushing = false
  }
}

export function startSyncQueue(): void {
  void flushSyncQueue()
  window.addEventListener('online', () => void flushSyncQueue())
}

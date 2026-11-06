import { pb } from './pocketbase'
import { trackEvent } from './analytics'

type Cell = { value: unknown; changedAt: string; dirty: boolean }
type State = Record<string, Cell>
const active = new Map<string, Promise<void>>()
const storageKey = (userId: string) => `atlas-workspace-state:${userId}`
function read(userId: string): State { try { return JSON.parse(localStorage.getItem(storageKey(userId)) ?? '{}') as State } catch { return {} } }
function write(userId: string, state: State) {
  localStorage.setItem(storageKey(userId), JSON.stringify(state))
  window.dispatchEvent(new CustomEvent('atlas:workspace-state', { detail: { userId } }))
}
export function workspaceValue<T>(userId: string, key: string, fallback: T): T { return (read(userId)[key]?.value as T | undefined) ?? fallback }
export function completedLessons(userId: string): string[] {
  let legacy: string[] = []
  try { const value: unknown = JSON.parse(localStorage.getItem(`atlas-lessons:${userId}`) ?? '[]'); if (Array.isArray(value)) legacy = value.filter((id): id is string => typeof id === 'string') } catch { /* old storage is optional */ }
  const saved = Object.entries(read(userId)).filter(([key, cell]) => key.startsWith('lesson:') && cell.value === true).map(([key]) => key.slice(7))
  return [...new Set([...legacy, ...saved])]
}
export function setWorkspaceValue(userId: string, key: string, value: unknown): void {
  const state = read(userId)
  state[key] = { value, changedAt: new Date().toISOString(), dirty: true }
  write(userId, state)
  void syncWorkspaceState(userId)
}
export function workspacePending(userId: string): number { return Object.values(read(userId)).filter(cell => cell.dirty).length }
const ownsSession = (userId: string) => pb.authStore.isValid && pb.authStore.record?.id === userId
export function syncWorkspaceState(userId: string): Promise<void> {
  if (!ownsSession(userId) || !navigator.onLine) return Promise.resolve()
  const running = active.get(userId)
  if (running) return running
  const promise = (async () => {
    try {
      // Migrate earlier device-local lesson completion without losing it.
      const state = read(userId)
      for (const lesson of completedLessons(userId)) if (!state[`lesson:${lesson}`]) state[`lesson:${lesson}`] = { value: true, changedAt: new Date().toISOString(), dirty: true }
      write(userId, state)
      const collection = pb.collection('atlas_workspace_state')
      const records = await collection.getFullList({ filter: pb.filter('user = {:user}', { user: userId }), requestKey: null })
      if (!ownsSession(userId)) return
      const remote = new Map(records.map(record => [String(record.key), record]))
      const merged = read(userId)
      for (const record of records) {
        const key = String(record.key), local = merged[key]
        if (!local || (!local.dirty && String(record.client_updated_at) >= local.changedAt) || (key.startsWith('lesson:') && record.value === true)) merged[key] = { value: record.value, changedAt: String(record.client_updated_at), dirty: false }
      }
      write(userId, merged)
      for (const [key, cell] of Object.entries(merged)) {
        if (!cell.dirty || !ownsSession(userId)) continue
        const payload = { value: cell.value, client_updated_at: cell.changedAt }
        let record = remote.get(key)
        if (!record) {
          try { record = await collection.create({ user: userId, key, ...payload }, { requestKey: null }) }
          catch (error) {
            if (!ownsSession(userId)) return
            // Resolve a concurrent first write on another device, then update the same row.
            record = await collection.getFirstListItem(pb.filter('user = {:user} && key = {:key}', { user: userId, key }), { requestKey: null }).catch(() => { throw error })
          }
        }
        if (!record) throw new Error('state row unavailable')
        if (!ownsSession(userId)) return
        if (key.startsWith('lesson:') || String(record.client_updated_at) <= cell.changedAt) record = await collection.update(record.id, payload, { requestKey: null })
        if (!record) throw new Error('state update unavailable')
        if (!ownsSession(userId)) return
        const current = read(userId)
        if (current[key]?.changedAt === cell.changedAt) current[key] = { value: record.value, changedAt: String(record.client_updated_at), dirty: false }
        write(userId, current)
      }
      trackEvent('Workspace sync completed', { pending: workspacePending(userId) })
    } catch {
      // Durable local cells remain dirty; retry on reconnect, focus, or the next periodic flush.
      trackEvent('Workspace sync deferred', { pending: workspacePending(userId) })
    }
  })().finally(() => { active.delete(userId) })
  active.set(userId, promise)
  return promise
}

export async function mergeGuestWorkspaceState(userId: string): Promise<void> {
  if (!ownsSession(userId)) return
  const guest = read('local'), account = read(userId)
  for (const lesson of completedLessons('local')) guest[`lesson:${lesson}`] ??= { value: true, changedAt: new Date().toISOString(), dirty: true }
  for (const [key, cell] of Object.entries(guest)) {
    if (!account[key] || key.startsWith('lesson:') || cell.changedAt > account[key].changedAt) account[key] = { ...cell, dirty: true }
  }
  write(userId, account)
  localStorage.removeItem(storageKey('local'))
  localStorage.removeItem('atlas-lessons:local')
  await syncWorkspaceState(userId)
}

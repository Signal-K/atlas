import { db, type ObservationLogEntry, type StreakState, type SyncQueueItem } from './db'
import { pocketBaseUrl } from './pocketbase'

export interface LocalOpsLink {
  label: string
  href: string
  description: string
}

export interface LocalOpsContainer {
  name: string
  kind: string
  url?: string
  status: 'checking' | 'online' | 'offline' | 'local-only'
  detail: string
}

export interface LocalTransaction {
  id: string
  source: string
  action: string
  detail: string
  at: string
}

export interface LocalOpsSnapshot {
  links: LocalOpsLink[]
  containers: LocalOpsContainer[]
  transactions: LocalTransaction[]
}

function asDate(value?: string): number {
  return value ? new Date(value).getTime() : 0
}

async function probePocketBase(): Promise<LocalOpsContainer['status']> {
  try {
    const response = await fetch(`${pocketBaseUrl.replace(/\/$/, '')}/api/health`, { cache: 'no-store' })
    return response.ok ? 'online' : 'offline'
  } catch {
    return 'offline'
  }
}

function observationTransaction(entry: ObservationLogEntry): LocalTransaction {
  return {
    id: `observation-${entry.id}`,
    source: 'atlas_observations',
    action: entry.sharedToFeed ? 'shared' : 'created',
    detail: entry.note ?? 'Observation log entry',
    at: entry.observedAt,
  }
}

function queueTransaction(entry: SyncQueueItem): LocalTransaction {
  return {
    id: `queue-${entry.id}`,
    source: entry.collection,
    action: entry.op,
    detail: entry.recordId,
    at: entry.queuedAt,
  }
}

function streakTransaction(entry: StreakState): LocalTransaction {
  return {
    id: `streak-${entry.userId}`,
    source: 'atlas_streaks',
    action: 'updated',
    detail: `${entry.currentWeeks} current weeks, ${entry.longestWeeks} longest`,
    at: entry.lastLoggedWeekStart,
  }
}

export async function getLocalOpsSnapshot(): Promise<LocalOpsSnapshot> {
  const [pbStatus, observations, queued, streaks] = await Promise.all([
    probePocketBase(),
    db.observations.orderBy('observedAt').reverse().limit(8).toArray(),
    db.syncQueue.orderBy('queuedAt').reverse().limit(8).toArray(),
    db.streaks.toArray(),
  ])

  const transactions = [
    ...observations.map(observationTransaction),
    ...queued.map(queueTransaction),
    ...streaks.map(streakTransaction),
  ]
    .sort((a, b) => asDate(b.at) - asDate(a.at))
    .slice(0, 12)

  const base = pocketBaseUrl.replace(/\/$/, '')
  return {
    links: [
      {
        label: 'PocketBase API',
        href: base,
        description: 'Local or configured Atlas PocketBase endpoint.',
      },
      {
        label: 'PocketBase Admin',
        href: `${base}/_/`,
        description: 'PocketBase admin UI for local collection inspection.',
      },
      {
        label: 'Health check',
        href: `${base}/api/health`,
        description: 'Direct health endpoint used by this local ops view.',
      },
    ],
    containers: [
      {
        name: 'atlas-pocketbase',
        kind: 'PocketBase',
        url: base,
        status: pbStatus,
        detail: pbStatus === 'online' ? 'Health endpoint responded.' : 'No health response from configured PocketBase URL.',
      },
      {
        name: 'atlas-web',
        kind: 'Vite dev server',
        url: window.location.origin,
        status: 'local-only',
        detail: 'Current browser session. Docker status is not readable from a static SPA.',
      },
    ],
    transactions,
  }
}

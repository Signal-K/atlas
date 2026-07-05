import Dexie, { type EntityTable } from 'dexie'

// Local-first mirror of the Atlas PocketBase collections. Reads/writes go
// here first; the sync engine (AT-003) reconciles with PocketBase when online.

export interface SkyEvent {
  id: string
  kind: string // e.g. 'meteor_shower' | 'moon_phase' | 'iss_pass' | 'eclipse' | 'conjunction'
  target: string // e.g. 'moon', 'perseids'
  title: string
  description: string
  content?: string
  imageUrl?: string
  imageCredit?: string
  startsAt: string
  endsAt: string
  latitude?: number
  longitude?: number
  updatedAt: string
}

export interface Favourite {
  id: string
  userId: string
  kind: 'event_type' | 'target'
  value: string
}

export interface WatchlistEntry {
  id: string
  userId: string
  favouriteId: string
  notifyOnGoodViewing: boolean
}

export interface ObservationLogEntry {
  id: string
  userId: string
  observedAt: string
  eventId?: string
  note?: string
}

export interface StreakState {
  userId: string // primary key
  currentWeeks: number
  longestWeeks: number
  lastLoggedWeekStart: string
}

export interface SyncQueueItem {
  id?: number
  collection: 'atlas_favourites' | 'atlas_watchlist' | 'atlas_observations' | 'atlas_streaks'
  op: 'create' | 'update' | 'delete'
  recordId: string
  payload?: unknown
  queuedAt: string
}

export interface PinnedEvent {
  eventId: string // primary key
  pinnedAt: string
}

class AtlasDB extends Dexie {
  skyEvents!: EntityTable<SkyEvent, 'id'>
  favourites!: EntityTable<Favourite, 'id'>
  watchlist!: EntityTable<WatchlistEntry, 'id'>
  observations!: EntityTable<ObservationLogEntry, 'id'>
  streaks!: EntityTable<StreakState, 'userId'>
  syncQueue!: EntityTable<SyncQueueItem, 'id'>
  pinnedEvents!: EntityTable<PinnedEvent, 'eventId'>

  constructor() {
    super('atlas')
    this.version(1).stores({
      skyEvents: 'id, kind, target, startsAt',
      favourites: 'id, userId, kind, value',
      watchlist: 'id, userId, favouriteId',
      observations: 'id, userId, observedAt',
      streaks: 'userId',
      syncQueue: '++id, collection, queuedAt',
    })
    this.version(2).stores({
      pinnedEvents: 'eventId',
    })
  }
}

export const db = new AtlasDB()

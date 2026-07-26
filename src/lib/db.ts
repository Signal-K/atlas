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

export type AttemptRating = 'poor' | 'ok' | 'good' | 'great'

export interface ObservationLogEntry {
  id: string
  userId: string
  observedAt: string
  eventId?: string
  note?: string
  sharedToFeed?: boolean
  targetName?: string
  deviceUsed?: string
  cameraRecipeUsed?: string
  locationLabel?: string
  conditionSummary?: string
  attemptRating?: AttemptRating
  photo?: Blob
  // STS-175 (public share card): the PocketBase record id, captured once
  // this entry has been pushed remotely -- distinct from `id` above, which
  // is a locally generated crypto.randomUUID() and never matches PocketBase's
  // own id format. A public share link points at remoteId, not id.
  remoteId?: string
  isPublic?: boolean
  // Sky Pass "AI photo caption" (see pocketbase/pb_hooks/photo-caption.pb.js)
  // -- set once the server-side vision request succeeds; absent otherwise
  // (feature not enabled, request failed, or still pending).
  aiCaption?: string
}

export interface StreakState {
  userId: string // primary key
  currentWeeks: number
  longestWeeks: number
  lastLoggedWeekStart: string
}

export interface SyncQueueItem {
  id?: number
  collection: 'atlas_favourites' | 'atlas_watchlist' | 'atlas_observations' | 'atlas_streaks' | 'atlas_camera_presets'
  op: 'create' | 'update' | 'delete'
  recordId: string
  payload?: unknown
  queuedAt: string
}

export interface PinnedEvent {
  eventId: string // primary key
  pinnedAt: string
}

export type PresetSource = 'builtin' | 'imported' | 'community'

// A single device's settings within a preset (mirrors DeviceRecipe's shape
// in cameraRecipes.ts but as structured, matchable data rather than prose).
export interface CameraPresetSettings {
  mode?: string
  lens?: string
  iso?: number
  whiteBalanceKelvin?: number
  exposureSec?: number
  filters?: string[]
}

export interface CameraPreset {
  id: string
  userId: string
  device: string // DeviceId from cameraProfiles.ts, kept as string to avoid an import cycle
  targetKey?: string // RecipeKey from cameraRecipes.ts, when this preset is target-specific
  name: string
  settings: CameraPresetSettings
  source: PresetSource
  sourceUrl?: string
  notes?: string
  createdAt: string
}

class AtlasDB extends Dexie {
  skyEvents!: EntityTable<SkyEvent, 'id'>
  favourites!: EntityTable<Favourite, 'id'>
  watchlist!: EntityTable<WatchlistEntry, 'id'>
  observations!: EntityTable<ObservationLogEntry, 'id'>
  streaks!: EntityTable<StreakState, 'userId'>
  syncQueue!: EntityTable<SyncQueueItem, 'id'>
  pinnedEvents!: EntityTable<PinnedEvent, 'eventId'>
  cameraPresets!: EntityTable<CameraPreset, 'id'>

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
    this.version(3).stores({
      cameraPresets: 'id, userId, device, targetKey, source',
    })
    this.version(4).stores({
      cameraPresets: 'id, userId, [userId+targetKey], device, targetKey, source',
    })
    // New observation fields (targetName, deviceUsed, etc.) don't need a
    // schema/index change -- Dexie stores whatever properties are on the
    // object -- so no version(3) bump is needed for those. Kept here as a
    // marker comment since it's easy to assume a new field always needs one.
  }
}

export const db = new AtlasDB()

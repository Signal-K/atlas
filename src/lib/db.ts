import Dexie, { type EntityTable } from 'dexie'

// Local-first mirror of the Atlas PocketBase collections. Reads/writes go
// here first; the sync engine (AT-003) reconciles with PocketBase when online.

export interface SkyEvent {
  id: string
  kind: string // e.g. 'meteor_shower' | 'moon_phase' | 'iss_pass' | 'eclipse' | 'conjunction' | 'light_pollution_campaign'
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
  // Private R2 object metadata. `photo` remains the offline/local preview;
  // the object key is intentionally not put in any public page URL.
  photoR2Key?: string
  photoR2Size?: number
  // Citizen-science submission (e.g. 'globe_at_night'). Set by the capture
  // flow when the entry is logged against a citizen-science campaign event;
  // absent on an ordinary Journal entry. See citizenScienceBadges.ts.
  citizenScienceProject?: string
  // Real coordinates, distinct from the free-text locationLabel -- only
  // populated when the capture flow already has one on hand (currently:
  // citizen-science submissions, which the skybrightness processor needs
  // an actual lat/lon for to constrain its plate-solve).
  latitude?: number
  longitude?: number
  // The remaining sky_brightness* fields are processor output -- written
  // back asynchronously by the atlas-extensions skybrightness service after
  // it plate-solves the submitted photo, not by the client at submit time.
  skyBrightnessLimitingMagnitude?: number
  skyBrightnessConfidence?: 'estimated' | 'modelled' | 'measured'
  skyBrightnessBortleEstimate?: number
  skyBrightnessStarsDetected?: number
  // Whether the uploaded photo was RAW or a processed/denoised JPEG -- a
  // phone's computational "night mode" breaks the linear photon-count
  // relationship photometry depends on, so the processor records what it
  // actually got rather than silently claiming RAW-grade precision.
  skyBrightnessSourceFormat?: 'raw' | 'jpeg' | 'unknown'
  skyBrightnessFlaggedForReview?: boolean
}

export interface StreakState {
  userId: string // primary key
  currentWeeks: number
  longestWeeks: number
  lastLoggedWeekStart: string
}

export interface SyncQueueItem {
  id?: number
  collection: 'atlas_favourites' | 'atlas_watchlist' | 'atlas_observations' | 'atlas_streaks' | 'atlas_camera_presets' | 'atlas_tagged_events'
  op: 'create' | 'update' | 'delete'
  recordId: string
  payload?: unknown
  queuedAt: string
}

export interface PinnedEvent {
  eventId: string // primary key
  pinnedAt: string
}

// A per-event bookmark (distinct from Favourite/WatchlistEntry above, which
// are keyed by event *kind*/*target* -- "watch all meteor showers" -- not a
// single event instance). Tagging an event is "I want this specific
// occurrence in my feed and to be notified about it", not "notify me about
// every future event like this."
export interface TaggedEvent {
  id: string
  userId: string
  eventId: string
  taggedAt: string
  remoteId?: string
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
  taggedEvents!: EntityTable<TaggedEvent, 'id'>

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
    this.version(5).stores({
      taggedEvents: 'id, userId, eventId, [userId+eventId]',
    })
    // New observation fields (targetName, deviceUsed, etc.) don't need a
    // schema/index change -- Dexie stores whatever properties are on the
    // object -- so no version(3) bump is needed for those. Kept here as a
    // marker comment since it's easy to assume a new field always needs one.
  }
}

export const db = new AtlasDB()

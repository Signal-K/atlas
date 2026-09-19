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
  // Private R2 object metadata. `photo` remains the offline/local preview;
  // the object key is intentionally not put in any public page URL.
  photoR2Key?: string
  photoR2Size?: number

  // --- Backdated check-ins (see src/lib/checkInRules.ts) ---
  //
  // All optional and none indexed, which is why adding them needs no Dexie
  // version bump: Dexie stores whatever is on the object and only the
  // documented indexes matter. An entry predating this feature simply has
  // them undefined, and every reader treats undefined as "not a backdated
  // check-in" -- which is the truth for those rows.
  //
  // `checkInKind` is stored rather than inferred from `observedAt < now`,
  // because that comparison is true of *every* entry in a diary and would
  // label the whole journal as backdated.
  checkInKind?: 'tonight' | 'past'
  matchConfidence?: 'strong' | 'possible' | 'weak' | 'none'
  matchedBy?: 'photo-exif' | 'photo-exif-heading' | 'manual'
  // How the place was established when there was no photo GPS to read it
  // from. The reviewer and the diary both need to show why this place, and
  // re-deriving it later would read today's trips, not the ones that applied.
  anchorSource?: 'trip' | 'trip-plan' | 'journal-location' | 'current-location' | 'manual'
  anchorLabel?: string
  // The only honest record that the civil date was a judgement call -- see
  // resolvePhotoDay in exifDateTime.mjs.
  photoDayAmbiguous?: boolean
  // Offline-first: the Journal has to render review state with no network
  // round-trip, so it is mirrored locally. The queue collection owns the
  // truth; this is a copy. `unsent` is required rather than cosmetic -- see
  // submitForReview in checkInReview.ts.
  //
  // `withdrawn` is the user retracting their own claim (the entry stays in the
  // diary, it just stops counting toward a city stamp). It is a distinct state
  // from `rejected`, which is the reviewer's word, and from `unsent`, which the
  // retry sweep would helpfully resubmit.
  reviewStatus?: 'not_required' | 'unsent' | 'pending' | 'approved' | 'rejected' | 'withdrawn'
  // Reconciles a pulled queue row back to this Dexie entry.
  reviewSubmissionId?: string
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

export const CAMERA_PRESET_SCHEMA_VERSION = 2

// Capture parameters (mirrors DeviceRecipe's shape in cameraRecipes.ts but as
// structured, matchable data rather than prose). No OS lets a third-party
// app inject these into a stock camera app without native code, so this half
// of a preset stays a manual checklist for now (see KES-295/KES-302).
export interface CaptureSettings {
  mode?: string
  lens?: string
  iso?: number
  whiteBalanceKelvin?: number
  exposureSec?: number
  focusDistance?: string
}

// Color-grade parameters. Unlike `capture`, these can be computed into a
// real importable file today -- a .cube 3D LUT (Nothing Camera) or a
// Lightroom .xmp preset (iOS) -- since color grading is just a pixel
// transform, not a camera-hardware control (see KES-297/KES-298).
export interface LookSettings {
  contrast?: number // -100..100
  saturation?: number // -100..100
  highlights?: number // -100..100
  shadows?: number // -100..100
  temperatureShiftKelvin?: number
  tint?: number // -100..100, green/magenta
  toneCurve?: Array<[number, number]> // [input, output] control points, 0-255
  filters?: string[]
}

export interface CameraPresetSettings {
  schemaVersion: typeof CAMERA_PRESET_SCHEMA_VERSION
  capture?: CaptureSettings
  look?: LookSettings
}

// Pre-v2 shape: flat capture fields at the top level, no schemaVersion.
// Preserved so callers holding older CameraPreset records (Dexie rows saved
// before this split, or a re-imported bundle) can be normalized -- see
// normalizePresetSettings() in cameraPresets.ts.
export interface LegacyCameraPresetSettingsV1 {
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

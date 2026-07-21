import { db, type CameraPreset, type Favourite, type ObservationLogEntry, type WatchlistEntry } from './db'
import { getEquipmentChoice, listLocalTargetTaps } from './firstPlanJourney'
import { pb } from './pocketbase'
import { pushObservation } from './sync'

const LOCAL_USER_ID = 'local'

export interface MergeResult {
  favourites: number
  watchlist: number
  observations: number
  cameraPresets: number
  targetTaps: number
  equipmentChoice: number
  total: number
}

// Runs once, right after a signed-out visitor creates an account (STS-322).
// Everything logged while signed out lives under the fixed 'local' scope id
// (see ScrapbookView/watchlist/CameraRecipe) -- without this, it would stay
// invisible forever once `scopeId()` starts resolving to the real user id.
// Duplicates (same kind+value / device+targetKey+name) already present under
// the new account are dropped rather than double-counted or double-pushed.
export async function mergeLocalDataIntoAccount(newUserId: string): Promise<MergeResult> {
  const favouriteIdRemap = new Map<string, string>()
  const mergedFavourites: Favourite[] = []
  const mergedWatchlist: WatchlistEntry[] = []
  const mergedObservations: ObservationLogEntry[] = []
  const mergedPresets: CameraPreset[] = []

  await db.transaction('rw', db.favourites, db.watchlist, db.observations, db.cameraPresets, async () => {
    const localFavourites = await db.favourites.where('userId').equals(LOCAL_USER_ID).toArray()
    const existingFavourites = await db.favourites.where('userId').equals(newUserId).toArray()
    for (const favourite of localFavourites) {
      const duplicate = existingFavourites.find((f) => f.kind === favourite.kind && f.value === favourite.value)
      if (duplicate) {
        favouriteIdRemap.set(favourite.id, duplicate.id)
        await db.favourites.delete(favourite.id)
        continue
      }
      favouriteIdRemap.set(favourite.id, favourite.id)
      await db.favourites.update(favourite.id, { userId: newUserId })
      mergedFavourites.push({ ...favourite, userId: newUserId })
    }

    const localWatchlist = await db.watchlist.where('userId').equals(LOCAL_USER_ID).toArray()
    const existingWatchlist = await db.watchlist.where('userId').equals(newUserId).toArray()
    for (const entry of localWatchlist) {
      const favouriteId = favouriteIdRemap.get(entry.favouriteId) ?? entry.favouriteId
      const duplicate = existingWatchlist.some((w) => w.favouriteId === favouriteId)
      if (duplicate) {
        await db.watchlist.delete(entry.id)
        continue
      }
      await db.watchlist.update(entry.id, { userId: newUserId, favouriteId })
      mergedWatchlist.push({ ...entry, userId: newUserId, favouriteId })
    }

    const localObservations = await db.observations.where('userId').equals(LOCAL_USER_ID).toArray()
    for (const entry of localObservations) {
      await db.observations.update(entry.id, { userId: newUserId })
      mergedObservations.push({ ...entry, userId: newUserId })
    }

    const localPresets = await db.cameraPresets.where('userId').equals(LOCAL_USER_ID).toArray()
    const existingPresets = await db.cameraPresets.where('userId').equals(newUserId).toArray()
    for (const preset of localPresets) {
      const duplicate = existingPresets.find(
        (p) => p.device === preset.device && p.targetKey === preset.targetKey && p.name === preset.name,
      )
      if (duplicate) {
        await db.cameraPresets.delete(preset.id)
        continue
      }
      await db.cameraPresets.update(preset.id, { userId: newUserId })
      mergedPresets.push({ ...preset, userId: newUserId })
    }
  })

  // Best-effort remote push, same pattern as the rest of Atlas's sync --
  // failures here leave the migrated rows local-only under the new account
  // rather than losing them. Only the rows just migrated are pushed, not
  // whatever the account already had synced, so nothing gets double-created.
  if (pb.authStore.isValid && navigator.onLine) {
    for (const favourite of mergedFavourites) {
      try {
        await pb.collection('atlas_favourites').create({ user: newUserId, kind: favourite.kind, value: favourite.value })
      } catch {
        // Likely already exists (unique index) or offline race — local copy stands either way.
      }
    }

    for (const entry of mergedWatchlist) {
      try {
        await pb
          .collection('atlas_watchlist')
          .create({ user: newUserId, favourite: entry.favouriteId, notify_on_good_viewing: entry.notifyOnGoodViewing })
      } catch {
        // Offline race or already exists — local copy stands.
      }
    }

    for (const entry of mergedObservations) {
      await pushObservation(entry)
    }
  }

  const targetTaps = listLocalTargetTaps().length
  const equipmentChoice = getEquipmentChoice() ? 1 : 0

  return {
    favourites: mergedFavourites.length,
    watchlist: mergedWatchlist.length,
    observations: mergedObservations.length,
    cameraPresets: mergedPresets.length,
    targetTaps,
    equipmentChoice,
    total: mergedFavourites.length + mergedWatchlist.length + mergedObservations.length + mergedPresets.length + targetTaps + equipmentChoice,
  }
}

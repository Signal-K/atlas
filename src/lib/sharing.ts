// Public share cards (STS-175). The public page (SharePage.tsx) reads the
// PocketBase atlas_observations record directly rather than a duplicated
// copy, so deleting the source observation or flipping `public` back off
// removes public access immediately -- no separate cleanup path needed.
//
// This is one of the few places that calls `pb` directly instead of going
// through db.ts/sync.ts: an anonymous visitor loading someone else's shared
// card has no local Dexie mirror of that stranger's data to read from.
import { pb } from './pocketbase'
import { db, type AttemptRating, type ObservationLogEntry } from './db'
import { parsePbDate } from './pocketbaseDate'
import { isAtlasMediaEnabled, publicObservationPhotoUrl, uploadObservationPhoto } from './atlasMedia'

export interface PublicObservationCard {
  targetName?: string
  deviceUsed?: string
  cameraRecipeUsed?: string
  note?: string
  attemptRating?: AttemptRating
  observedAt: string
  photoUrl?: string
}

export function shareUrlForRemoteId(remoteId: string): string {
  return `${window.location.origin}/p/${remoteId}`
}

export async function getPublicObservation(remoteId: string): Promise<PublicObservationCard | null> {
  try {
    const record = await pb.collection('atlas_observations').getOne(remoteId)
    return {
      targetName: record.target_name || undefined,
      deviceUsed: record.device_used || undefined,
      cameraRecipeUsed: record.camera_recipe_used || undefined,
      note: record.note || undefined,
      attemptRating: record.attempt_rating || undefined,
      // parsePbDate, not the raw field -- ShareCard.tsx calls
      // new Date(data.observedAt) directly, which is Invalid Date in real
      // Safari on PocketBase's raw space-separated format. See pocketbaseDate.ts.
      observedAt: parsePbDate(record.observed_at).toISOString(),
      photoUrl: record.photo_r2_key ? publicObservationPhotoUrl(record.id) : record.photo ? pb.files.getURL(record, record.photo) : undefined,
    }
  } catch {
    return null
  }
}

// Requires sign-in (mirrors the existing "Share to Feed" gating in
// ScrapbookView) since a public card is tied to a PocketBase-owned record.
export async function shareObservation(entry: ObservationLogEntry): Promise<string> {
  if (!pb.authStore.isValid) throw new Error('Sign in to share a public card')

  if (entry.remoteId) {
    if (entry.photo && !entry.photoR2Key && isAtlasMediaEnabled()) {
      const uploaded = await uploadObservationPhoto(entry.remoteId, entry.photo)
      await pb.collection('atlas_observations').update(entry.remoteId, { photo_r2_key: uploaded.key, photo_r2_size: uploaded.size })
      await db.observations.update(entry.id, { photoR2Key: uploaded.key, photoR2Size: uploaded.size })
    }
    await pb.collection('atlas_observations').update(entry.remoteId, { public: true })
    await db.observations.update(entry.id, { remoteId: entry.remoteId, isPublic: true })
    return shareUrlForRemoteId(entry.remoteId)
  }

  const useR2 = Boolean(entry.photo && isAtlasMediaEnabled())
  const record = await pb.collection('atlas_observations').create({
    user: pb.authStore.record?.id,
    observed_at: entry.observedAt,
    event: entry.eventId,
    note: entry.note,
    target_name: entry.targetName,
    device_used: entry.deviceUsed,
    camera_recipe_used: entry.cameraRecipeUsed,
    location_label: entry.locationLabel,
    condition_summary: entry.conditionSummary,
    attempt_rating: entry.attemptRating,
    public: true,
    ...(!useR2 && entry.photo ? { photo: entry.photo } : {}),
  })
  if (useR2 && entry.photo) {
    const uploaded = await uploadObservationPhoto(record.id, entry.photo)
    await pb.collection('atlas_observations').update(record.id, { photo_r2_key: uploaded.key, photo_r2_size: uploaded.size })
  }
  await db.observations.update(entry.id, { remoteId: record.id, isPublic: true })
  return shareUrlForRemoteId(record.id)
}

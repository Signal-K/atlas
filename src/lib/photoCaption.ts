import { pb } from './pocketbase'
import { db } from './db'

// Client for the Sky Pass "AI photo caption" endpoint
// (pocketbase/pb_hooks/photo-caption.pb.js). That endpoint requires a
// server-side ANTHROPIC_API_KEY and is not enabled on every deployment --
// this call is expected to fail with a plain 400 ("not enabled on this
// deployment") wherever it isn't configured, so callers should treat a
// failure here as "feature unavailable," not an error worth surfacing loudly.

function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // reader.result is "data:<mime>;base64,<data>" -- strip the prefix.
      const result = reader.result as string
      const commaIndex = result.indexOf(',')
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Could not read photo.'))
    reader.readAsDataURL(file)
  })
}

export interface RequestPhotoCaptionInput {
  photo: Blob
  targetName?: string
  conditionSummary?: string
  observationId?: string
  observationRemoteId?: string
}

// Best-effort: returns the caption string on success, null on any failure
// (not configured, not entitled, network error, etc.) -- never throws, so
// callers can fire this after a save without special-casing every possible
// reason it might not be available.
export async function requestPhotoCaption(input: RequestPhotoCaptionInput): Promise<string | null> {
  if (!pb.authStore.isValid) return null

  try {
    const photoBase64 = await fileToBase64(input.photo)
    const result = await pb.send<{ caption?: string }>('/atlas/observations/caption', {
      method: 'POST',
      // pb.send() only JSON-encodes a plain-object body when Content-Type
      // is explicitly "application/json" -- without this header it would
      // hand the object straight to fetch(), which doesn't accept one.
      headers: { 'Content-Type': 'application/json' },
      body: {
        photoBase64,
        mimeType: input.photo.type || 'image/jpeg',
        targetName: input.targetName,
        conditionSummary: input.conditionSummary,
        observationId: input.observationRemoteId,
      },
    })
    const caption = result?.caption
    if (!caption) return null

    if (input.observationId) {
      await db.observations.update(input.observationId, { aiCaption: caption })
    }
    return caption
  } catch {
    return null
  }
}

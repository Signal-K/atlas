import { pb } from './pocketbase'

const mediaBaseUrl = (import.meta.env.VITE_ATLAS_MEDIA_URL as string | undefined)?.replace(/\/$/, '')

export interface R2PhotoUpload {
  key: string
  size: number
  contentType: string
}

export function isAtlasMediaEnabled(): boolean {
  return Boolean(mediaBaseUrl)
}

function requireMediaUrl(): string {
  if (!mediaBaseUrl) throw new Error('Atlas media storage is not configured.')
  return mediaBaseUrl
}

function authHeaders(): HeadersInit {
  if (!pb.authStore.isValid) throw new Error('Sign in to upload a photo.')
  return { Authorization: pb.authStore.token }
}

export async function uploadObservationPhoto(observationId: string, photo: Blob): Promise<R2PhotoUpload> {
  const response = await fetch(`${requireMediaUrl()}/v1/observations/${encodeURIComponent(observationId)}/photo`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'content-type': photo.type || 'image/jpeg' },
    body: photo,
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) {
    let message = 'Photo upload failed.'
    try {
      const body = await response.json() as { error?: unknown }
      if (typeof body.error === 'string' && body.error.trim()) message = body.error
    } catch {
      // The Worker may be unavailable or return a non-JSON edge error.
    }
    throw new Error(message)
  }
  return response.json() as Promise<R2PhotoUpload>
}

export async function fetchPrivateObservationPhoto(key: string): Promise<Blob | undefined> {
  try {
    const response = await fetch(`${requireMediaUrl()}/v1/photos?key=${encodeURIComponent(key)}`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(20_000),
    })
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
    return response.ok && contentType.startsWith('image/') ? await response.blob() : undefined
  } catch {
    return undefined
  }
}

export function publicObservationPhotoUrl(observationId: string): string | undefined {
  return mediaBaseUrl ? `${mediaBaseUrl}/v1/public/photos/${encodeURIComponent(observationId)}` : undefined
}

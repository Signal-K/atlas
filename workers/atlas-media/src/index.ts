import { DurableObject } from 'cloudflare:workers'

interface Env {
  ATLAS_MEDIA: R2Bucket
  ATLAS_MEDIA_QUOTA: DurableObjectNamespace<AtlasMediaQuota>
  POCKETBASE_URL: string
  ALLOWED_ORIGINS: string
  R2_STORAGE_SOFT_LIMIT_BYTES: string
  R2_MONTHLY_UPLOAD_SOFT_LIMIT: string
}

interface PocketBaseRecord {
  id: string
  photo_r2_key?: string
  public?: boolean
}

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024
const BOOTSTRAP_STALE_AFTER_MS = 5 * 60 * 1000
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

interface QuotaState {
  usedBytes: number
  month: string
  monthlyUploadAttempts: number
}

type QuotaDecision =
  | { accepted: true; reservationId: string; remainingBytes: number }
  | { accepted: false; reason: 'storage' | 'uploads'; message: string }

function utcMonth(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

function configuredPositiveInteger(value: string): number | null {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

async function bucketUsage(bucket: R2Bucket): Promise<{ usedBytes: number; objectCount: number }> {
  let usedBytes = 0
  let objectCount = 0
  let cursor: string | undefined
  do {
    const page = await bucket.list({ cursor, limit: 1_000 })
    usedBytes += page.objects.reduce((sum, object) => sum + object.size, 0)
    objectCount += page.objects.length
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
  return { usedBytes, objectCount }
}

// A single ledger is the correct coordination point for the account-wide R2
// allowance. It reserves quota before the Worker writes bytes to R2, so a
// concurrent upload cannot push Atlas past its deliberate safety buffer.
export class AtlasMediaQuota extends DurableObject<Env> {
  private async loadState(): Promise<QuotaState> {
    const existing = await this.ctx.storage.get<QuotaState>('quota')
    if (existing) return existing

    const bootstrappingSince = await this.ctx.storage.get<number>('bootstrappingSince')
    if (bootstrappingSince && Date.now() - bootstrappingSince < BOOTSTRAP_STALE_AFTER_MS) {
      throw new Error('Atlas media capacity is being checked. Please try again in a moment.')
    }

    // Persist this marker before the R2 list. R2 I/O may interleave DO
    // requests, so later uploads fail closed rather than race the bootstrap.
    await this.ctx.storage.put('bootstrappingSince', Date.now())
    try {
      const usage = await bucketUsage(this.env.ATLAS_MEDIA)
      const state: QuotaState = {
        usedBytes: usage.usedBytes,
        month: utcMonth(),
        // Existing objects may have been written before this guard was
        // introduced. Treat all of them as this month's attempts on the
        // first check: that can only reject too early, never bill too much.
        monthlyUploadAttempts: usage.objectCount,
      }
      await this.ctx.storage.put('quota', state)
      await this.ctx.storage.delete('bootstrappingSince')
      return state
    } catch (error) {
      await this.ctx.storage.delete('bootstrappingSince')
      throw error
    }
  }

  async reserve(uploadBytes: number): Promise<QuotaDecision> {
    if (!Number.isSafeInteger(uploadBytes) || uploadBytes <= 0) {
      throw new Error('Invalid media size.')
    }

    const storageLimit = configuredPositiveInteger(this.env.R2_STORAGE_SOFT_LIMIT_BYTES)
    const monthlyUploadLimit = configuredPositiveInteger(this.env.R2_MONTHLY_UPLOAD_SOFT_LIMIT)
    if (!storageLimit || !monthlyUploadLimit) {
      throw new Error('Atlas media capacity is not configured safely.')
    }

    const previous = await this.loadState()
    const month = utcMonth()
    const state: QuotaState = previous.month === month
      ? previous
      : { ...previous, month, monthlyUploadAttempts: 0 }

    if (state.usedBytes + uploadBytes > storageLimit) {
      return {
        accepted: false,
        reason: 'storage',
        message: 'Atlas photo storage is at its safety limit. This upload was not sent to Cloudflare.',
      }
    }
    if (state.monthlyUploadAttempts + 1 > monthlyUploadLimit) {
      return {
        accepted: false,
        reason: 'uploads',
        message: 'Atlas has reached its monthly upload safety limit. This upload was not sent to Cloudflare.',
      }
    }

    const reservationId = crypto.randomUUID()
    await this.ctx.storage.put({
      quota: {
        ...state,
        usedBytes: state.usedBytes + uploadBytes,
        monthlyUploadAttempts: state.monthlyUploadAttempts + 1,
      },
      [`reservation:${reservationId}`]: uploadBytes,
    })
    return { accepted: true, reservationId, remainingBytes: storageLimit - state.usedBytes - uploadBytes }
  }

  async commit(reservationId: string): Promise<void> {
    await this.ctx.storage.delete(`reservation:${reservationId}`)
  }

  async releaseWithoutUpload(reservationId: string): Promise<void> {
    const reservedBytes = await this.ctx.storage.get<number>(`reservation:${reservationId}`)
    if (!reservedBytes) return
    const state = await this.ctx.storage.get<QuotaState>('quota')
    if (state) {
      await this.ctx.storage.put('quota', { ...state, usedBytes: Math.max(0, state.usedBytes - reservedBytes) })
    }
    // Keep the attempt count: an uncertain/failed R2 request may still count
    // as a Class A operation, and conservative accounting avoids an overage.
    await this.ctx.storage.delete(`reservation:${reservationId}`)
  }
}

function corsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers({ Vary: 'Origin' })
  const origin = request.headers.get('Origin')
  const allowed = env.ALLOWED_ORIGINS.split(',').map((value) => value.trim())
  if (origin && allowed.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, PUT, OPTIONS')
    headers.set('Access-Control-Max-Age', '86400')
  }
  return headers
}

function responseJson(request: Request, env: Env, body: unknown, init: ResponseInit = {}): Response {
  const headers = corsHeaders(request, env)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  new Headers(init.headers).forEach((value, key) => headers.set(key, value))
  return new Response(JSON.stringify(body), { ...init, headers })
}

function responseError(request: Request, env: Env, status: number, message: string): Response {
  return responseJson(request, env, { error: message }, { status })
}

function authToken(request: Request): string | null {
  const value = request.headers.get('Authorization')?.trim()
  return value || null
}

async function authenticatedUser(request: Request, env: Env): Promise<PocketBaseRecord | null> {
  const token = authToken(request)
  if (!token) return null
  const response = await fetch(`${env.POCKETBASE_URL}/api/collections/users/auth-refresh`, {
    method: 'POST',
    headers: { Authorization: token },
  })
  if (!response.ok) return null
  const data = (await response.json()) as { record?: PocketBaseRecord }
  return data.record?.id ? data.record : null
}

async function observationForOwner(observationId: string, token: string, env: Env): Promise<PocketBaseRecord | null> {
  const response = await fetch(`${env.POCKETBASE_URL}/api/collections/atlas_observations/records/${encodeURIComponent(observationId)}`, {
    headers: { Authorization: token },
  })
  return response.ok ? (response.json() as Promise<PocketBaseRecord>) : null
}

function isSafeKey(key: string): boolean {
  return /^observations\/[a-zA-Z0-9]+\/[a-zA-Z0-9]+\/[a-zA-Z0-9-]+\.(jpg|png|webp)$/.test(key)
}

function imageResponse(request: Request, env: Env, object: R2ObjectBody): Response {
  const headers = corsHeaders(request, env)
  object.writeHttpMetadata(headers)
  headers.set('ETag', object.httpEtag)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Cache-Control', 'private, no-store')
  return new Response(object.body, { headers })
}

async function putPhoto(request: Request, env: Env, observationId: string): Promise<Response> {
  const token = authToken(request)
  const user = await authenticatedUser(request, env)
  if (!token || !user) return responseError(request, env, 401, 'Sign in required.')

  const observation = await observationForOwner(observationId, token, env)
  if (!observation) return responseError(request, env, 404, 'Observation not found.')
  if (observation.photo_r2_key) return responseError(request, env, 409, 'This observation already has a photo.')

  const contentType = request.headers.get('Content-Type')?.split(';')[0].toLowerCase() ?? ''
  const extension = IMAGE_EXTENSIONS[contentType]
  if (!extension) return responseError(request, env, 415, 'Upload a JPEG, PNG, or WebP image.')

  const data = await request.arrayBuffer()
  if (data.byteLength === 0 || data.byteLength > MAX_UPLOAD_BYTES) {
    return responseError(request, env, 413, 'The optimised image must be no larger than 12 MB.')
  }

  let reservation: Extract<QuotaDecision, { accepted: true }>
  try {
    const decision = await env.ATLAS_MEDIA_QUOTA.getByName('account-wide-r2-budget').reserve(data.byteLength)
    if (!decision.accepted) return responseError(request, env, 507, decision.message)
    reservation = decision
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Atlas media capacity could not be checked.'
    return responseError(request, env, 503, message)
  }

  const key = `observations/${user.id}/${observationId}/${crypto.randomUUID()}.${extension}`
  let object: R2Object | null
  try {
    object = await env.ATLAS_MEDIA.put(key, data, {
      httpMetadata: { contentType, cacheControl: 'private, no-store' },
      customMetadata: { owner: user.id, observation: observationId },
    })
  } catch {
    // Keep the reservation: a timed-out write can still have reached R2.
    // Under-counting here would make the account cap bypassable on retries.
    return responseError(request, env, 500, 'Photo storage could not be confirmed. The capacity reservation was kept for safety.')
  }
  if (!object) {
    await env.ATLAS_MEDIA_QUOTA.getByName('account-wide-r2-budget').releaseWithoutUpload(reservation.reservationId)
    return responseError(request, env, 500, 'Photo storage failed.')
  }
  // An uncommitted reservation remains safely counted if this cleanup call
  // fails, so it can never turn a storage error into an overage.
  try {
    await env.ATLAS_MEDIA_QUOTA.getByName('account-wide-r2-budget').commit(reservation.reservationId)
  } catch {
    // The object has been stored; keeping the reservation is safe and avoids
    // turning a successful write into a client retry/duplicate upload.
  }
  return responseJson(request, env, { key: object.key, size: object.size, contentType })
}

async function getPrivatePhoto(request: Request, env: Env): Promise<Response> {
  const token = authToken(request)
  const user = await authenticatedUser(request, env)
  const key = new URL(request.url).searchParams.get('key')
  if (!token || !user) return responseError(request, env, 401, 'Sign in required.')
  if (!key || !isSafeKey(key)) return responseError(request, env, 400, 'Invalid photo key.')

  const object = await env.ATLAS_MEDIA.get(key)
  if (!object || object.customMetadata?.owner !== user.id || !object.body) return responseError(request, env, 404, 'Photo not found.')
  return imageResponse(request, env, object)
}

async function getPublicPhoto(request: Request, env: Env, observationId: string): Promise<Response> {
  // This PocketBase view is anonymous only for `public = true` records. The
  // R2 key itself remains private and is never included in the public URL.
  const response = await fetch(`${env.POCKETBASE_URL}/api/collections/atlas_observations/records/${encodeURIComponent(observationId)}`)
  if (!response.ok) return responseError(request, env, 404, 'Photo not found.')
  const observation = (await response.json()) as PocketBaseRecord
  if (!observation.public || !observation.photo_r2_key || !isSafeKey(observation.photo_r2_key)) return responseError(request, env, 404, 'Photo not found.')

  const object = await env.ATLAS_MEDIA.get(observation.photo_r2_key)
  if (!object || object.customMetadata?.observation !== observationId || !object.body) return responseError(request, env, 404, 'Photo not found.')
  return imageResponse(request, env, object)
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) })

    const upload = url.pathname.match(/^\/v1\/observations\/([a-zA-Z0-9]+)\/photo$/)
    if (request.method === 'PUT' && upload) return putPhoto(request, env, upload[1])
    if (request.method === 'GET' && url.pathname === '/v1/photos') return getPrivatePhoto(request, env)

    const publicPhoto = url.pathname.match(/^\/v1\/public\/photos\/([a-zA-Z0-9]+)$/)
    if (request.method === 'GET' && publicPhoto) return getPublicPhoto(request, env, publicPhoto[1])
    return responseError(request, env, 404, 'Not found.')
  },
} satisfies ExportedHandler<Env>

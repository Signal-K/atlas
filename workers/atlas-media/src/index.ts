interface Env {
  ATLAS_MEDIA: R2Bucket
  POCKETBASE_URL: string
  ALLOWED_ORIGINS: string
}

interface PocketBaseRecord {
  id: string
  photo_r2_key?: string
  public?: boolean
}

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
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

  const contentType = request.headers.get('Content-Type')?.split(';')[0].toLowerCase() ?? ''
  const extension = IMAGE_EXTENSIONS[contentType]
  if (!extension) return responseError(request, env, 415, 'Upload a JPEG, PNG, or WebP image.')

  const data = await request.arrayBuffer()
  if (data.byteLength === 0 || data.byteLength > MAX_UPLOAD_BYTES) {
    return responseError(request, env, 413, 'The optimised image must be no larger than 12 MB.')
  }

  const key = `observations/${user.id}/${observationId}/${crypto.randomUUID()}.${extension}`
  const object = await env.ATLAS_MEDIA.put(key, data, {
    httpMetadata: { contentType, cacheControl: 'private, no-store' },
    customMetadata: { owner: user.id, observation: observationId },
  })
  if (!object) return responseError(request, env, 500, 'Photo storage failed.')
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

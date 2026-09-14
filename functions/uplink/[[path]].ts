// First-party reverse proxy for PostHog capture, served from the Atlas domain
// as a Cloudflare Pages Function.
//
// Why: Atlas sent analytics straight to us.i.posthog.com. Ad blockers match
// that hostname and drop the request before it is counted, so an unknown share
// of every pageview, session recording, and survey event was lost -- an
// undercount the team could not measure, because the missing events never
// arrived. Routing capture through the app's own origin (see api_host in
// src/lib/analytics.ts) keeps it off those blocklists.
//
// Routing mirrors PostHog's reference Cloudflare Worker:
//   /static/* , /array/*  -> asset host (recorder.js, array.js, surveys.js)
//   everything else        -> API host  (/e, /i/v0/e, /s, /flags, /surveys)
// https://posthog.com/docs/advanced/proxy/cloudflare

const API_HOST = 'us.i.posthog.com'
const ASSET_HOST = 'us-assets.i.posthog.com'

// This file lives at functions/uplink/[[path]].ts, so Pages invokes it for
// every /uplink/* request. Strip that mount prefix before forwarding so
// PostHog receives its own canonical paths.
const MOUNT_PREFIX = '/uplink'

interface ProxyContext {
  request: Request
  waitUntil: (promise: Promise<unknown>) => void
}

// Static assets are immutable per version and shared by every visitor, so a
// cache hit at the edge saves a round trip to the asset host.
async function retrieveAsset(request: Request, target: string, waitUntil: ProxyContext['waitUntil']): Promise<Response> {
  const cache = caches.default
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(target, { headers: { Accept: request.headers.get('Accept') ?? '*/*' } })
  waitUntil(cache.put(request, response.clone()))
  return response
}

async function forwardRequest(request: Request, target: string): Promise<Response> {
  const headers = new Headers(request.headers)
  // The browser sends this request same-origin, so it carries the visitor's
  // Atlas cookies (Clerk session) and any auth header. Neither belongs at
  // PostHog -- strip them before the request leaves our origin.
  headers.delete('cookie')
  headers.delete('authorization')
  // Preserve the real client IP for PostHog's geolocation; without it the
  // origin only sees Cloudflare's address.
  const clientIp = request.headers.get('CF-Connecting-IP')
  if (clientIp) headers.set('X-Forwarded-For', clientIp)

  // Stream the body straight through instead of buffering it. Session
  // recording batches can be tens of KB, and there's no reason to hold a whole
  // payload in edge memory before the origin fetch starts.
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  return fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    duplex: 'half',
    redirect: 'manual',
  })
}

export const onRequest = async (context: ProxyContext): Promise<Response> => {
  const { request } = context
  const url = new URL(request.url)
  const path = url.pathname.slice(MOUNT_PREFIX.length) || '/'
  const isAsset = path.startsWith('/static/') || path.startsWith('/array/')
  const target = `https://${isAsset ? ASSET_HOST : API_HOST}${path}${url.search}`
  return isAsset ? retrieveAsset(request, target, context.waitUntil) : forwardRequest(request, target)
}

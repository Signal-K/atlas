import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../functions/uplink/[[path]].ts', import.meta.url), 'utf8')
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
}).outputText
const { onRequest } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`)

function installEdgeMocks(fetchImplementation) {
  const cache = new Map()
  const pending = []
  globalThis.caches = {
    default: {
      match: async (request) => cache.get(request.url),
      put: async (request, response) => cache.set(request.url, response),
    },
  }
  globalThis.fetch = fetchImplementation
  return {
    pending,
    context(request) {
      return { request, waitUntil: (promise) => pending.push(promise) }
    },
  }
}

test('forwards capture requests only to PostHog after stripping Atlas credentials', async () => {
  let target
  let init
  const edge = installEdgeMocks(async (url, options) => {
    target = url
    init = options
    return new Response('accepted', { status: 202 })
  })
  const request = new Request('https://youratlas.cc/uplink/i/v0/e/?ip=1', {
    method: 'POST',
    headers: {
      authorization: 'Bearer atlas-session',
      cookie: '__session=secret',
      'cf-connecting-ip': '198.51.100.8',
      'content-type': 'application/json',
    },
    body: '{"event":"opened"}',
  })

  const response = await onRequest(edge.context(request))

  assert.equal(target, 'https://us.i.posthog.com/i/v0/e/?ip=1')
  assert.equal(init.headers.get('authorization'), null)
  assert.equal(init.headers.get('cookie'), null)
  assert.equal(init.headers.get('x-forwarded-for'), '198.51.100.8')
  assert.equal(await new Response(init.body).text(), '{"event":"opened"}')
  assert.equal(response.status, 202)
})

test('routes and edge-caches PostHog recorder assets', async () => {
  const calls = []
  const edge = installEdgeMocks(async (url) => {
    calls.push(url)
    return new Response('asset', { headers: { 'content-type': 'application/javascript' } })
  })
  const request = new Request('https://youratlas.cc/uplink/static/recorder.js?version=1', {
    headers: { accept: 'application/javascript' },
  })

  const first = await onRequest(edge.context(request))
  await Promise.all(edge.pending)
  const second = await onRequest(edge.context(request))

  assert.deepEqual(calls, ['https://us-assets.i.posthog.com/static/recorder.js?version=1'])
  assert.equal(await first.text(), 'asset')
  assert.equal(await second.text(), 'asset')
})

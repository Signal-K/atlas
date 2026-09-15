import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const analytics = await readFile(new URL('../src/lib/analytics.ts', import.meta.url), 'utf8')
const entitlementSync = await readFile(new URL('../src/providers/useEntitlementSync.ts', import.meta.url), 'utf8')
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const hub = await readFile(new URL('../src/pages/HubPage.tsx', import.meta.url), 'utf8')

test('session replay is not client-sampled or force-started', () => {
  assert.doesNotMatch(analytics, /sampleRate\s*:/)
  assert.doesNotMatch(analytics, /disable_session_recording\s*:/)
  assert.match(analytics, /maskAllInputs:\s*true/)
  assert.match(analytics, /posthog\.startSessionRecording\(\)/)
  assert.doesNotMatch(analytics, /startSessionRecording\(\s*true\s*\)/)
})

test('persisted signed-in users are identified before the first pageview', () => {
  assert.match(analytics, /bootstrap:\s*\{\s*distinctID:\s*persistedUser\.id,\s*isIdentifiedID:\s*true/)
  assert.match(analytics, /loaded:\s*\(loadedPosthog\)\s*=>/)
  assert.match(analytics, /applyIdentifiedUser\(loadedPosthog,\s*persistedUser\)/)
})

test('product paths include /app and /tonight but not landing', () => {
  assert.match(analytics, /pathname === '\/app'/)
  assert.match(analytics, /pathname === '\/tonight'/)
  assert.match(analytics, /Landing \(`\/`,/)
})

test('sign-in identify and in-app navigation both start product recording', () => {
  assert.match(analytics, /export function identifyAnalyticsUser/)
  assert.match(analytics, /maybeStartProductSessionRecording\(posthog\)/)
  assert.match(analytics, /export function startProductSessionRecording/)
  assert.match(entitlementSync, /startProductSessionRecording\(\)/)
  assert.match(entitlementSync, /routerLocation\.pathname/)
})

test('/tonight stays a product route so replay URL triggers can match', () => {
  assert.match(app, /isTonightRoute/)
  assert.match(app, /pathname === '\/tonight'/)
  assert.match(app, /isAppRoute = routerLocation\.pathname\.startsWith\('\/app'\) \|\| isTonightRoute/)
})

test('hub still emits the replay event-trigger alias Generated tonight plan', () => {
  assert.match(hub, /Tonight plan generation succeeded/)
  assert.match(hub, /Generated tonight plan/)
})

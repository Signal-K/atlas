import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const deploy = await readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8')
const analytics = await readFile(new URL('../src/lib/analytics.ts', import.meta.url), 'utf8')
const pocketbase = await readFile(new URL('../src/lib/pocketbase.ts', import.meta.url), 'utf8')

// The production build step is the one whose dist/ actually deploys. The
// earlier `npm test` step builds too, but its output is superseded.
const productionBuild = deploy.slice(deploy.indexOf('- run: npm run build'), deploy.indexOf('cloudflare/pages-action'))

// ASV-42. Every VITE_* the app reads at runtime has a development default, so
// omitting one from the workflow does not fail the build -- it silently ships
// the default. That is exactly how checkout ended up POSTing to localhost in
// production. Each of these must be handed to the build that deploys.
const REQUIRED_BUILD_VARS = [
  'VITE_PB_URL',
  'VITE_ATLAS_BILLING_URL',
  'VITE_POLAR_CHECKOUT_URL',
  'VITE_CLERK_PUBLISHABLE_KEY',
  'VITE_POSTHOG_KEY',
]

test('the deploying build receives every runtime service URL', () => {
  for (const name of REQUIRED_BUILD_VARS) {
    assert.match(
      productionBuild,
      new RegExp(`${name}:\\s*\\$\\{\\{\\s*vars\\.${name}\\s*\\}\\}`),
      `${name} is not passed to the production build in deploy.yml, so the bundle will ship its development default`,
    )
  }
})

test('every service URL with a dev default is covered by the required list', () => {
  // Guards against a new `import.meta.env.VITE_X ?? 'http://127.0.0.1:...'`
  // being added without also being wired into the deploy workflow.
  const defaults = [...pocketbase.matchAll(/import\.meta\.env\.(VITE_\w+)\s*\?\?\s*'http:\/\/127\.0\.0\.1/g)]
  assert.ok(defaults.length > 0, 'expected pocketbase.ts to declare localhost fallbacks')
  for (const [, name] of defaults) {
    assert.ok(
      REQUIRED_BUILD_VARS.includes(name),
      `${name} falls back to localhost but is not in REQUIRED_BUILD_VARS, so nothing checks the deploy passes it`,
    )
  }
})

test('the build is verified before it is uploaded to Cloudflare', () => {
  const guardIndex = deploy.indexOf('scripts/verify-build.mjs')
  const uploadIndex = deploy.indexOf('cloudflare/pages-action')
  assert.ok(guardIndex !== -1, 'deploy.yml must run scripts/verify-build.mjs')
  assert.ok(guardIndex < uploadIndex, 'the build guard must run before the Cloudflare upload, not after')
})

// ASV-43. The proxy is only in effect when nothing overrides it.
test('analytics falls back to the first-party proxy when no host is configured', () => {
  assert.match(analytics, /api_host:\s*\(import\.meta\.env\.VITE_POSTHOG_HOST[^)]*\)\s*\|\|\s*'\/uplink'/)
})

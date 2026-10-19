// Post-build guard for the artifact that actually ships.
//
// Two production incidents motivated this, and both were invisible to the
// existing test suite because the suite only ever checked source files:
//
//   ASV-42  deploy.yml never passed VITE_ATLAS_BILLING_URL, so the bundle
//           fell back to src/lib/pocketbase.ts's dev default and production
//           shipped a Sky Pass button that POSTed to http://127.0.0.1:8093 on
//           the visitor's own machine. Checkout had been dead for weeks.
//
//   ASV-43  ASV-30 added a first-party PostHog proxy at /uplink, but the
//           pre-existing VITE_POSTHOG_HOST repo variable overrode it, so the
//           proxy shipped and was never used. test/uplink-proxy.test.mjs
//           passed the whole time -- it tests the Pages Function in isolation.
//
// The common shape is a config value that is only wrong in the built output.
// So this reads dist/ and nothing else.

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

const DIST = new URL('../dist/', import.meta.url)

// A string only Atlas's own analytics module emits, used to tell our chunk
// apart from posthog-js's vendor chunk. The vendor chunk hardcodes
// `https://us.i.posthog.com` as its built-in default no matter how the SDK is
// configured, so scanning every file for that hostname reports a problem that
// is not one. What matters is the host *we* pass to posthog.init().
const ANALYTICS_MARKER = 'atlas_user_id'

const CAPTURE_HOST = /https:\/\/(us|eu)\.i\.posthog\.com/

async function bundleFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true })
  return entries
    .filter((entry) => entry.isFile() && /\.(js|html|css)$/.test(entry.name))
    .map((entry) => join(entry.parentPath ?? entry.path, entry.name))
}

let files
try {
  files = await bundleFiles(DIST)
} catch (err) {
  console.error(`verify-build: cannot read dist/ -- run \`npm run build\` first. (${err.message})`)
  process.exit(1)
}

if (files.length === 0) {
  console.error('verify-build: dist/ contains no JS/HTML/CSS. Did the build actually run?')
  process.exit(1)
}

const sources = new Map()
for (const file of files) sources.set(file, await readFile(file, 'utf8'))

const failures = []

// --- A development default leaked into a production bundle. ----------------
// Catches any VITE_* service URL that was not supplied to the build, not just
// the billing one -- the same footgun exists for VITE_PB_URL.
for (const [file, contents] of sources) {
  const match = contents.match(/(?:127\.0\.0\.1|localhost):\d{2,5}/)
  if (!match) continue
  failures.push(
    `${file} references ${match[0]}. A VITE_* service URL is missing from the build environment, so the ` +
      `bundle fell back to a development default. Check VITE_ATLAS_BILLING_URL and VITE_PB_URL are set as ` +
      `GitHub Actions variables and passed in .github/workflows/deploy.yml.`,
  )
}

// --- Analytics must go through the first-party proxy. ----------------------
const analyticsChunks = [...sources].filter(([, contents]) => contents.includes(ANALYTICS_MARKER))

if (analyticsChunks.length === 0) {
  // Either analytics was tree-shaken out or the marker was renamed. Both mean
  // this check silently stopped checking anything, which is how ASV-43 shipped.
  failures.push(
    `no bundled chunk contains ${ANALYTICS_MARKER}, so the analytics host could not be verified. ` +
      `If src/lib/analytics.ts was refactored, update ANALYTICS_MARKER in this script.`,
  )
}

for (const [file, contents] of analyticsChunks) {
  const direct = contents.match(CAPTURE_HOST)
  if (direct) {
    failures.push(
      `${file} sends analytics straight to ${direct[0]} instead of the first-party /uplink proxy. Clear the ` +
        `VITE_POSTHOG_HOST GitHub Actions variable (repo *and* the production environment) so ` +
        `src/lib/analytics.ts falls back to '/uplink'.`,
    )
  } else if (!contents.includes('/uplink')) {
    failures.push(
      `${file} configures analytics but never references the /uplink proxy. Expected api_host to fall back ` +
        `to '/uplink' (src/lib/analytics.ts).`,
    )
  }
}

if (failures.length > 0) {
  console.error(`verify-build: ${failures.length} problem(s) in the production bundle:\n`)
  for (const failure of failures) console.error(`  - ${failure}\n`)
  process.exit(1)
}

console.log(
  `verify-build: ${files.length} bundled files checked; ` +
    `no development URLs, analytics proxied through /uplink.`,
)

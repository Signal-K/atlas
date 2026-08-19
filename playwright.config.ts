import 'dotenv/config'
import { defineConfig, devices } from '@playwright/test'

const e2ePort = process.env.PLAYWRIGHT_PORT || '5173'
const e2eBaseURL = `http://localhost:${e2ePort}`
// Write-action coverage is deliberately opt-in. It must use an existing,
// provisioned non-production PocketBase service; Playwright must never create
// a blank PocketBase data directory (and therefore a new-superuser setup
// screen) merely to run this repository's normal test suite.
const writeTestPbUrl = process.env.E2E_WRITE_PB_URL

// STS-333: end-to-end coverage for the anonymous first-plan journey. Runs
// against a real Vite dev server talking to whatever PocketBase VITE_PB_URL
// points at (defaults to the docker-compose stack's :8094) -- network calls
// that would make the test flaky (weather, sky events) are mocked per-test,
// not here, so this config stays about wiring, not fixtures.
//
// KES-189: the 4 specs that drive AuthForm now render Clerk's own
// <SignIn>/<SignUp> and need a real (test-mode) Clerk session, per Clerk's
// own Playwright testing guidance -- see e2e/global.setup.ts and
// e2e/support/clerk.ts. That's real network to Clerk's test API, so those
// specs are slower and need CLERK_SECRET_KEY / VITE_CLERK_PUBLISHABLE_KEY
// set (already in .env.local for local runs).
//
// KES-190: those same 4 specs also complete the loop through
// POST /auth/clerk-exchange on whatever VITE_PB_URL points at. CI/deploy
// default VITE_PB_URL to the production backend (vars.VITE_PB_URL) -- and
// production now correctly only verifies tokens against the *live* Clerk
// instance, not the test-mode instance these specs authenticate against
// (no CI/preview backend is provisioned with the test secret key yet).
// Excluded there until that exists; still run locally and against any
// VITE_PB_URL that's actually wired to the test instance.
const skipLiveClerkBackendSpecs = process.env.CLERK_BACKEND_UNAVAILABLE === '1'

export default defineConfig({
  testDir: './e2e',
  testIgnore: skipLiveClerkBackendSpecs
    ? ['**/demo-access.spec.ts', '**/signup-journey.spec.ts', '**/existing-account-signup.spec.ts']
    : undefined,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  timeout: 45_000,
  use: {
    baseURL: e2eBaseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'setup', testMatch: /global\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] },
  ],
  webServer: {
    command: `npm run dev -- --port ${e2ePort}`,
    url: e2eBaseURL,
    reuseExistingServer: false,
    env: {
      VITE_PB_URL: writeTestPbUrl || process.env.VITE_PB_URL || 'http://localhost:8094',
      VITE_POLAR_CHECKOUT_URL: process.env.VITE_POLAR_CHECKOUT_URL || `${e2eBaseURL}/fallback-checkout`,
    },
    timeout: 30_000,
  },
})

import 'dotenv/config'
import { defineConfig, devices } from '@playwright/test'

const e2ePort = process.env.PLAYWRIGHT_PORT || '5173'
const e2eBaseURL = `http://localhost:${e2ePort}`

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
export default defineConfig({
  testDir: './e2e',
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
      VITE_PB_URL: process.env.VITE_PB_URL || 'http://localhost:8094',
      VITE_POLAR_CHECKOUT_URL: process.env.VITE_POLAR_CHECKOUT_URL || `${e2eBaseURL}/fallback-checkout`,
    },
    timeout: 30_000,
  },
})

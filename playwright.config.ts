import { defineConfig, devices } from '@playwright/test'

const e2ePort = process.env.PLAYWRIGHT_PORT || '5173'
const e2eBaseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${e2ePort}`

// The containerized staging workflow (staging-container-e2e.yml) already has
// a real docker-compose atlas+PocketBase stack running before Playwright
// starts, so it points PLAYWRIGHT_BASE_URL at that container and sets this
// to skip spawning a redundant local `npm run dev`.
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1'

// STS-333: end-to-end coverage for the anonymous first-plan journey. Runs
// against a real Vite dev server talking to whatever PocketBase VITE_PB_URL
// points at (defaults to the docker-compose stack's :8094) -- network calls
// that would make the test flaky (weather, sky events) are mocked per-test,
// not here, so this config stays about wiring, not fixtures.
export default defineConfig({
  testDir: './e2e',
  // The account journey intentionally talks to a disposable PocketBase
  // instance and is run by the dedicated CI write job. Keep it out of the
  // ordinary build/preview smoke suite, which has no backend.
  testIgnore: process.env.E2E_WRITE_TESTS ? [] : ['**/atlas-account-journey.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: e2eBaseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: skipWebServer
    ? undefined
    : {
        command: `npm run dev -- --port ${e2ePort}`,
        url: e2eBaseURL,
        reuseExistingServer: false,
        env: {
          VITE_PB_URL: process.env.VITE_PB_URL || 'http://localhost:8094',
        },
        timeout: 30_000,
      },
})

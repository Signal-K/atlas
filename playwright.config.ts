import { defineConfig, devices } from '@playwright/test'

// STS-333: end-to-end coverage for the anonymous first-plan journey. Runs
// against a real Vite dev server talking to whatever PocketBase VITE_PB_URL
// points at (defaults to the docker-compose stack's :8094) -- network calls
// that would make the test flaky (weather, sky events) are mocked per-test,
// not here, so this config stays about wiring, not fixtures.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: false,
    env: {
      VITE_PB_URL: process.env.VITE_PB_URL || 'http://localhost:8094',
      VITE_POLAR_CHECKOUT_URL: process.env.VITE_POLAR_CHECKOUT_URL || 'http://localhost:5173/fallback-checkout',
    },
    timeout: 30_000,
  },
})

import { defineConfig, devices } from '@playwright/test'
const port = process.env.PLAYWRIGHT_PORT || '5173'
const baseURL = `http://localhost:${port}`
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  timeout: 45000,
  use: { baseURL, trace: 'on-first-retry' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
    { name: 'webkit-iphone', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    env: { VITE_PB_URL: 'http://localhost:8094', VITE_POSTHOG_KEY: '' },
  },
})

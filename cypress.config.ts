import { defineConfig } from 'cypress'

// Runs against a deployed Cloudflare Pages URL (see
// .github/workflows/cypress-e2e.yml), not a local dev server -- baseUrl and
// viewport come entirely from env/CLI so the same suite exercises every
// staging deployment at every screen size the workflow's matrix defines.
export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL,
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    viewportWidth: 1440,
    viewportHeight: 900,
    defaultCommandTimeout: 10_000,
    retries: {
      runMode: 1,
      openMode: 0,
    },
  },
})

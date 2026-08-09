// Runs against a live Cloudflare Pages staging deployment (see
// .github/workflows/cypress-e2e.yml), at whatever viewport the workflow's
// matrix set for this run -- so failures here point at either a broken
// deploy or a screen-size-specific layout regression, not local dev drift.
//
// Kept in its own spec file, separate from authenticated.cy.ts: Chromium's
// back/forward cache can restore this file's landing-page visit + in-app
// client-side navigation from an in-memory snapshot on a later cy.visit(),
// which skips the real page load entirely -- so a signed-in spec seeding
// its session via cy.visit's onBeforeLoad (see support/auth.ts) can find
// localStorage silently empty if it runs later in the same spec. Cypress
// gives every spec file its own fresh browser context, which sidesteps it
// cleanly; a --disable-features=BackForwardCache launch flag was tried
// first and did not reliably prevent it.
describe('anonymous', () => {
  it('landing page renders and links into the app sign-in gate', () => {
    cy.visit('/')
    cy.contains('h1', /what can i see in the sky tonight/i).should('be.visible')

    cy.contains('button', /get started/i).first().click()
    cy.location('pathname').should('match', /\/app\/events$/)
    cy.contains('h1', /sign in to atlas/i).should('be.visible')
  })

  it('sign-in form switches to sign-up mode', () => {
    cy.visit('/app')
    cy.contains('button', /need an account/i).click()
    cy.contains('button', /create account/i).should('be.visible')
  })
})

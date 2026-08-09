import { seedSignedInUser } from '../support/auth'

// See anonymous.cy.ts for why this stays a separate spec file (a
// back/forward-cache gotcha with cy.visit's onBeforeLoad).
describe('authenticated', () => {
  it('signed-in user lands on Events with a nav that fits the current viewport', () => {
    cy.visit('/app', { onBeforeLoad: (win) => seedSignedInUser(win, { email: 'atlas-e2e@example.com' }) })

    cy.location('pathname').should('match', /\/app\/events$/)
    cy.contains('h1', /^events$/i).should('be.visible')

    // Below the nav shell's 900px breakpoint the primary nav collapses into
    // a bottom tab bar (row layout); above it, it's a column rail down the
    // left side. Asserting on the computed layout (not just visibility)
    // catches a breakpoint regression that visibility checks alone would miss.
    const expectedDirection = Cypress.config('viewportWidth') <= 900 ? 'row' : 'column'
    cy.get('.nav-shell-nav').should('have.css', 'flex-direction', expectedDirection)

    cy.get('.nav-shell-nav').contains('a', /account/i).click()
    cy.location('pathname').should('match', /\/app\/account$/)
    cy.contains('h1', /^account$/i).should('be.visible')
    cy.contains('atlas-e2e@example.com').should('be.visible')
  })
})

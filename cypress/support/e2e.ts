// Global support file, loaded before every spec. Kept intentionally empty --
// specs import ./auth's seedSignedInUser directly where they need it. The
// suite avoids Chromium's back/forward-cache gotcha by splitting specs that
// do in-app client-side navigation from specs that seed auth via
// cy.visit's onBeforeLoad (see anonymous.cy.ts for details), rather than by
// disabling bfcache at the browser level.

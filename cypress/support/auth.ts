// Mirrors e2e/support/auth.ts (the Playwright suite's helper): seeds a
// signed-in PocketBase session via localStorage so specs can land straight
// on /app without a real staging account. auth.ts's currentUser() only
// decodes the token payload client-side (pb.authStore.isValid checks
// expiry, not signature), so an unsigned token works the same way here as
// it does against a local dev server.
//
// PocketBase's authStore reads localStorage synchronously at module-load
// time, so this has to run via cy.visit's onBeforeLoad (before the app's
// own scripts execute) rather than cy.window().then(...) after the page
// has already loaded -- Playwright's addInitScript equivalent.
function makeAuthToken(): string {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    type: 'auth',
    collectionId: 'users',
  }
  // Cypress.Buffer is the browser `buffer` polyfill, not Node's -- it
  // doesn't support the 'base64url' encoding Node has, so encode standard
  // base64 instead. The app only ever feeds this through atob() (see
  // pocketbase's getTokenPayload), which needs standard base64 anyway.
  const encoded = Cypress.Buffer.from(JSON.stringify(payload)).toString('base64')
  return ['e2e', encoded, 'sig'].join('.')
}

export interface SeedSignedInUserOptions {
  id?: string
  email?: string
  entitled?: boolean
}

export function seedSignedInUser(win: Cypress.AUTWindow, options: SeedSignedInUserOptions = {}): void {
  const id = options.id ?? 'e2e-user'
  const email = options.email ?? 'atlas-e2e@example.com'
  const entitled = options.entitled ?? false

  win.localStorage.setItem(
    'pocketbase_auth',
    JSON.stringify({
      token: makeAuthToken(),
      record: { id, email, entitled },
    }),
  )
}

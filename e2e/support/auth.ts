import type { Page } from '@playwright/test'

export function makeAuthToken() {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    type: 'auth',
    collectionId: 'users',
  }
  return ['e2e', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'sig'].join('.')
}

export interface SeedSignedInUserOptions {
  id?: string
  email?: string
  entitled?: boolean
}

// Seeds a signed-in PocketBase session via localStorage so specs can land
// straight on /app without clicking through the sign-in form first.
export function seedSignedInUser(page: Page, options: SeedSignedInUserOptions = {}) {
  const id = options.id ?? 'e2e-user'
  const email = options.email ?? 'atlas-e2e@example.com'
  const entitled = options.entitled ?? false
  const token = makeAuthToken()

  return page.addInitScript(
    ({ tokenValue, userId, userEmail, entitledValue }) => {
      window.localStorage.setItem(
        'pocketbase_auth',
        JSON.stringify({
          token: tokenValue,
          record: { id: userId, email: userEmail, entitled: entitledValue },
        }),
      )
    },
    { tokenValue: token, userId: id, userEmail: email, entitledValue: entitled },
  )
}

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
  // Most specs here aren't testing onboarding itself -- they want to land
  // straight on the screen under test, so this defaults to already-done.
  // Pass false for specs that are specifically exercising OnboardingFlow
  // (its location step, its skip/continue buttons, etc).
  onboardingComplete?: boolean
}

// "Get started" now requires an account before onboarding or the app shell
// render at all (see AuthGate in App.tsx) -- most e2e specs aren't testing
// that gate itself, so this seeds a signed-in PocketBase session up front
// via localStorage, the same way entitlement-refresh.spec.ts already did,
// instead of clicking through sign-up on every test.
export function seedSignedInUser(page: Page, options: SeedSignedInUserOptions = {}) {
  const id = options.id ?? 'e2e-user'
  const email = options.email ?? 'atlas-e2e@example.com'
  const entitled = options.entitled ?? false
  const onboardingComplete = options.onboardingComplete ?? true
  const token = makeAuthToken()

  return page.addInitScript(
    ({ tokenValue, userId, userEmail, entitledValue, onboardingCompleteValue }) => {
      window.localStorage.setItem(
        'pocketbase_auth',
        JSON.stringify({
          token: tokenValue,
          record: { id: userId, email: userEmail, entitled: entitledValue },
        }),
      )
      window.localStorage.setItem('atlas-entered', '1')
      if (onboardingCompleteValue) {
        window.localStorage.setItem('atlas-onboarding-flow-complete', '1')
      }
    },
    { tokenValue: token, userId: id, userEmail: email, entitledValue: entitled, onboardingCompleteValue: onboardingComplete },
  )
}

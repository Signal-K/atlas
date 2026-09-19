import type { Page } from '@playwright/test'
import { ONBOARDING_VERSION } from '../../src/lib/onboarding'

// The onboarding gate compares a *version*, not a boolean (lib/onboarding.ts),
// so a hardcoded '1' would leave every seeded spec sitting behind the current
// flow the moment that flow gains a step. Importing the constant keeps the
// seed honest across future bumps instead of rotting silently.
//
// lib/onboarding.ts is safe to import from here: it has no imports of its own
// and never touches import.meta.env, unlike the components that consume it.
export function seedOnboardingComplete(page: Page, version: number = ONBOARDING_VERSION) {
  return page.addInitScript((value) => {
    window.localStorage.setItem('atlas-onboarding-flow-complete', String(value))
  }, version)
}

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
    ({ tokenValue, userId, userEmail, entitledValue, onboardingCompleteValue, versionValue }) => {
      window.localStorage.setItem(
        'pocketbase_auth',
        JSON.stringify({
          token: tokenValue,
          record: {
            id: userId,
            email: userEmail,
            entitled: entitledValue,
            onboarded: onboardingCompleteValue,
            // Both signals the gate reads are seeded, not just the local flag.
            // Seeding only localStorage would leave the account itself looking
            // like a brand-new signup (onboarding_version 0), and the next
            // sign-in event would then fire a real syncOnboardingToAccount()
            // write at the PocketBase URL under test -- a needless network
            // round-trip per spec, on a server that may not even be up.
            onboarding_version: onboardingCompleteValue ? versionValue : 0,
          },
        }),
      )
      window.localStorage.setItem('atlas-entered', '1')
      if (onboardingCompleteValue) {
        window.localStorage.setItem('atlas-onboarding-flow-complete', String(versionValue))
      }
    },
    {
      tokenValue: token,
      userId: id,
      userEmail: email,
      entitledValue: entitled,
      onboardingCompleteValue: onboardingComplete,
      versionValue: ONBOARDING_VERSION,
    },
  )
}

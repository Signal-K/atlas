import { createClerkClient } from '@clerk/backend'
import type { Page } from '@playwright/test'

// `+clerk_test` makes Clerk skip sending a real email and accept the fixed
// `424242` code for whichever verification strategy the SignIn/SignUp
// instance is configured with -- see
// https://clerk.com/docs/guides/development/testing/test-emails-and-phones
export function clerkTestEmail(label: string) {
  return `atlas-e2e-${label}-${Date.now()}+clerk_test@example.com`
}

export const CLERK_TEST_OTP = '424242'

function clerkClient() {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) throw new Error('CLERK_SECRET_KEY must be set to manage Clerk test users in e2e specs.')
  return createClerkClient({ secretKey })
}

export async function createClerkTestUser(email: string, password: string) {
  const client = clerkClient()
  return client.users.createUser({ emailAddress: [email], password })
}

// Cleans up a user by whichever identifier is available -- tests track the
// email up front (before the widget submits) so a crash mid-test still
// leaves something teardown-able, and fall back to id when known.
export async function deleteClerkTestUser({ id, email }: { id?: string; email?: string }) {
  const client = clerkClient()
  if (id) {
    await client.users.deleteUser(id).catch(() => {})
    return
  }
  if (!email) return
  const { data } = await client.users.getUserList({ emailAddress: [email] })
  await Promise.all(data.map((user) => client.users.deleteUser(user.id).catch(() => {})))
}

// Fills whichever optional fields the SignUp instance renders and submits,
// entering the fixed test OTP if Clerk asks for email verification. Mirrors
// the pattern from Clerk's own Playwright demo (clerk/clerk-playwright-nextjs).
export async function fillClerkSignUp(page: Page, email: string, password: string) {
  await page.waitForSelector('.cl-signUp-root', { state: 'attached' })

  const firstName = page.locator('input[name=firstName]')
  if (await firstName.isVisible().catch(() => false)) await firstName.fill('Atlas')
  const lastName = page.locator('input[name=lastName]')
  if (await lastName.isVisible().catch(() => false)) await lastName.fill('E2E')
  const username = page.locator('input[name=username]')
  if (await username.isVisible().catch(() => false)) await username.fill(email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ''))

  await page.locator('input[name=emailAddress]').fill(email)
  await page.locator('input[name=password]').fill(password)

  const legalCheckbox = page.locator('input[name=legalAccepted]')
  if (await legalCheckbox.isVisible().catch(() => false)) await legalCheckbox.check()

  // The Star Sailors instance requires email verification on sign-up --
  // the OTP field only mounts once Clerk's own prepare_verification call
  // resolves, so checking for it immediately after the click (rather than
  // waiting on that response first) is a race that silently loses on a
  // slow network turn and leaves the widget stuck on the code screen.
  const verificationResponse = page.waitForResponse((resp) => resp.url().includes('prepare_verification'), { timeout: 15_000 }).catch(() => null)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await verificationResponse

  const otpField = page.getByRole('textbox', { name: /verification code/i })
  if (await otpField.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await otpField.pressSequentially(CLERK_TEST_OTP)
  }
}

// Sign-up still goes through Clerk's prebuilt <SignUp>, but KES-190 replaced
// the prebuilt <SignIn> with a hand-rolled panel (AuthForm.tsx's
// ClerkSignInPanel) so a pre-migration PocketBase account can be claimed on
// its first Clerk sign-in. This helper was never updated and kept waiting for
// `.cl-signIn-root`, which that panel does not render -- so every spec that
// signed in sat on an untouched form until the 45s test timeout. Drive the
// real fields, and fall back to the prebuilt widget only when the panel
// escalates to it (`showStandardSignIn`, e.g. an already-linked account).
export async function fillClerkSignIn(page: Page, email: string, password: string) {
  const emailField = page.locator('#clerk-sign-in-email')
  await emailField.waitFor({ state: 'visible', timeout: 15_000 })
  await emailField.fill(email)
  await page.locator('#clerk-sign-in-password').fill(password)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  // The panel hands off to Clerk's prebuilt widget for any step it cannot
  // finish itself -- device trust on an unrecognised device is the usual one,
  // and every e2e run is an unrecognised device. The widget restarts the
  // attempt at its own identifier+password screen, which renders both fields
  // at once rather than as two steps, so fill whatever is on screen and press
  // Continue once per screen instead of assuming an order.
  // NB: locator.isVisible() is an immediate check -- it ignores a `timeout`
  // option rather than polling for one. Using it to wait here is what made
  // this helper give up the instant the custom form submitted, long before
  // the widget mounted, and fill nothing at all.
  const widget = page.locator('.cl-signIn-root')
  const appeared = await widget.waitFor({ state: 'visible', timeout: 20_000 }).then(() => true).catch(() => false)
  if (!appeared) return

  const identifier = widget.locator('input[name=identifier]')
  const passwordField = widget.locator('input[name=password]')

  // `.cl-signIn-root` mounts before the fields inside it do. Checking their
  // visibility immediately loses that race and silently fills nothing, which
  // then surfaces much later as an unrelated-looking assertion failure.
  await identifier.or(passwordField).first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})

  let submittedPassword = false
  if (await identifier.isVisible().catch(() => false)) {
    await identifier.fill(email)
    if (await passwordField.isVisible().catch(() => false)) {
      await passwordField.fill(password)
      submittedPassword = true
    }
    await widget.getByRole('button', { name: 'Continue', exact: true }).click()
  }

  // Only for instances that split identifier and password across two screens.
  // This has to be skipped when the combined screen already submitted both:
  // the password field stays visible through the transition, so an
  // unconditional check here fires, re-fills it and presses Continue a second
  // time. That second submit restarts the attempt behind the device-trust
  // screen, and the spec then sits on a code box that never accepts a code.
  if (!submittedPassword && (await passwordField.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false))) {
    await passwordField.fill(password)
    await widget.getByRole('button', { name: 'Continue', exact: true }).click()
  }

  // Device trust then asks for an emailed code -- every e2e run is a new
  // device, so this is the normal path, not an edge case. `+clerk_test`
  // addresses always accept the fixed test OTP.
  const otpField = widget.getByRole('textbox', { name: /code|verification/i }).first()
  if (await otpField.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false)) {
    // One <input maxlength=6> behind a segmented display. Typing into it
    // without focusing first, or faster than it re-renders per character,
    // leaves a partial code that never submits and hangs the spec until the
    // test timeout with the code box still on screen.
    await otpField.click()
    await otpField.pressSequentially(CLERK_TEST_OTP, { delay: 120 })
    // A complete code auto-submits and Clerk drops the button, so this is
    // only for instances that still want an explicit confirmation.
    const submit = widget.getByRole('button', { name: 'Continue', exact: true })
    if (await submit.isVisible().catch(() => false)) await submit.click()
  }
}

// Establishes the clerk_user_id link on the backend for a Clerk user ahead
// of any UI interaction, by minting a real session token via the Backend
// API and running it through the same /auth/clerk-exchange endpoint the
// browser hits. Lets a spec set up "this person already has an account"
// (a second exchange with the same clerkUserID returns created:false)
// without first driving the sign-up widget just to get there.
export async function primeClerkPocketBaseLink(pbUrl: string, clerkUserId: string) {
  const client = clerkClient()
  const session = await client.sessions.createSession({ userId: clerkUserId })
  const { jwt } = await client.sessions.getToken(session.id)
  const response = await fetch(`${pbUrl}/auth/clerk-exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: jwt }),
  })
  if (!response.ok) throw new Error(`Priming the Clerk/PocketBase link failed: ${response.status} ${await response.text()}`)
  return (await response.json()) as { token: string; record: { id: string; email: string } }
}

// AuthForm hands the PocketBase token/record off to pb.authStore.save(),
// which persists them under this key -- the same source pocketbase-js
// itself reads from on boot. Specs that need the token for direct API
// verification (e.g. writing through PocketBase's REST API as the signed-in
// user) read it back out here instead of re-deriving it another way.
export async function readPocketBaseAuth(page: Page) {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('pocketbase_auth')
    if (!raw) return null
    return JSON.parse(raw) as { token: string; record: { id: string; email: string } }
  })
}

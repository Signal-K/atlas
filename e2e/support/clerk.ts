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

export async function fillClerkSignIn(page: Page, email: string, password: string) {
  await page.waitForSelector('.cl-signIn-root', { state: 'attached' })
  await page.locator('input[name=identifier]').fill(email)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.locator('input[name=password]').fill(password)

  // A password match can still be followed by a second-factor/verification
  // step (e.g. an unrecognized-device check) -- same race as sign-up above,
  // waited out the same way rather than guessed at with a fixed timeout.
  const secondFactorResponse = page
    .waitForResponse((resp) => resp.url().includes('prepare_second_factor') || resp.url().includes('prepare_verification'), { timeout: 15_000 })
    .catch(() => null)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await secondFactorResponse

  const otpField = page.getByRole('textbox', { name: /verification code/i })
  if (await otpField.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await otpField.pressSequentially(CLERK_TEST_OTP)
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

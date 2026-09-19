import { expect, test, type Page } from '@playwright/test'
import { setupClerkTestingToken } from '@clerk/testing/playwright'
import { clerkTestEmail, createClerkTestUser, deleteClerkTestUser, fillClerkSignIn, fillClerkSignUp, primeClerkPocketBaseLink } from './support/clerk'
import { completeOnboarding } from './support/onboarding'
import { resolvePbUrl } from './support/pbUrl'
import { ONBOARDING_VERSION } from '../src/lib/onboarding'

const PB_URL = resolvePbUrl()

async function mockTonightData(page: Page) {
  await page.route('https://api.open-meteo.com/**', async (route) => {
    const days = 7
    const today = new Date()
    const time = Array.from({ length: days }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      return d.toISOString().slice(0, 10)
    })

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        timezone: 'Europe/London',
        daily: {
          time,
          cloud_cover_mean: Array(days).fill(10),
          precipitation_probability_mean: Array(days).fill(5),
        },
      }),
    })
  })

  await page.route('**/api/collections/sky_events/records**', async (route) => {
    const now = new Date()
    const startsAt = new Date(now.getTime() + 2 * 3_600_000)
    // Same trap as plan-screen: a moon_phase event only clears the
    // visibility gate if the Moon is above London's horizon during the
    // window, so a one-hour slot makes the Full Moon row appear or vanish
    // according to what time of day the suite runs. A full day always
    // contains a Moon-up sample.
    const endsAt = new Date(startsAt.getTime() + 24 * 3_600_000)

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'e2e-signup-moon',
            kind: 'moon_phase',
            target: 'moon',
            title: 'Full Moon',
            description: 'The Moon reaches its fullest point tonight.',
            content: 'The Moon reaches its fullest point tonight.',
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            updated: now.toISOString(),
          },
        ],
        page: 1,
        perPage: 500,
        totalItems: 1,
        totalPages: 1,
      }),
    })
  })

  await page.route('**/api/collections/atlas_observations/records', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'remote-observation' }),
    })
  })
}

test.beforeEach(async ({ page }) => {
  await mockTonightData(page)
  // Location moved from the landing page into OnboardingFlow's own
  // "location" step -- seed it directly, same as setManualLocation() would.
  await page.addInitScript(() => {
    window.localStorage.setItem('atlas-manual-location', JSON.stringify({ name: 'London', lat: 51.5074, lon: -0.1278 }))
  })
})

// ASV-47: the landing CTA opens tonight's sky as a guest -- no account, no
// signup form. Onboarding runs on entry (that is where a guest sets their
// location), and the auth gate is reached by asking for something an account
// actually owns. This proves the order: landing -> guest Hub -> onboarding ->
// gated feature -> account created -> the gated feature works, without
// dragging the new account back through onboarding a second time.
//
// KES-189: AuthGate now renders Clerk's own <SignUp>, exchanged for a
// PocketBase session via /auth/clerk-exchange -- both real, per Clerk's
// Playwright testing guidance (see e2e/support/clerk.ts).
test('signup happens via the auth gate before onboarding, then observations save directly', async ({ page }) => {
  const email = clerkTestEmail('signup-journey')
  const password = 'Correct-horse-battery1!'
  await setupClerkTestingToken({ page })

  try {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Every week the sky puts on something worth walking outside for.' })).toBeVisible()
    await page.getByRole('button', { name: 'See tonight’s sky', exact: true }).first().click()

    // Straight into the product as a guest -- no account demanded first.
    await expect(page).toHaveURL('/app/hub')

    // Onboarding runs on entry now, so a guest can set a location.
    await completeOnboarding(page)

    // Tonight's sky is readable without an account.
    await expect(page.getByText("You're browsing as a guest.")).toBeVisible()

    // The gate appears only when the guest asks for something an account owns.
    await page.getByRole('link', { name: /All events/ }).click()
    await expect(page.getByRole('heading', { name: 'Create your free account' })).toBeVisible()
    await fillClerkSignUp(page, email, password)

    await expect
      .poll(() =>
        page.evaluate(() => {
          const auth = JSON.parse(window.localStorage.getItem('pocketbase_auth') ?? '{}')
          return auth.record?.email
        }),
      )
      .toBe(email)

    // Onboarding was already finished as a guest, so signing up must not
    // replay it.
    await expect(page.getByRole('heading', { name: 'What should Atlas call you?' })).toHaveCount(0)

    await expect(page.getByRole('heading', { name: 'Events', exact: true })).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'Full Moon' }).click()
    await page.locator('.az-overlay').getByRole('button', { name: 'Log attempt' }).click()

    await expect(page).toHaveURL('/app/journal')
    await expect(page.getByText('Logging for')).toBeVisible()
    await page.getByPlaceholder('What did you see tonight?').fill('Saw the Moon through thin cloud.')
    await page.getByRole('button', { name: 'Good' }).click()
    await page.getByRole('button', { name: 'Save session' }).click()

    await expect(page.locator('.az-row-group').getByText('Saw the Moon through thin cloud.')).toBeVisible()
  } finally {
    await deleteClerkTestUser({ email })
  }
})

// This test used to assert the opposite -- that a returning account signs in
// and lands straight in the product without seeing onboarding. That is no
// longer the behaviour: ASV-53 made the gate a *version* comparison, so an
// account whose onboarding_version predates the current flow is sent through
// it rather than exempted by `onboarded`. The Clerk-side setup below is
// unchanged and still worth keeping -- it is what exercises the account's
// second login (created:false), which is the real returning-account case.
test('an existing account is re-run through the current onboarding flow', async ({ page }) => {
  const email = clerkTestEmail('signup-journey-returning')
  const password = 'Correct-horse-battery1!'
  const clerkUser = await createClerkTestUser(email, password)

  // Everything after the user exists belongs inside the try: priming the link
  // reaches PocketBase over the network, and when that throws (a stale
  // VITE_PB_URL is enough) the account created a line above never reaches the
  // finally below. That leak is what silently filled this Clerk development
  // instance to its 100-user cap, at which point every spec that signs up
  // fails for a reason that looks nothing like the real cause.
  try {
    // Establishes the clerk_user_id <-> PocketBase link ahead of time, so the
    // sign-in below is the account's *second* login (created:false) -- the
    // actual "existing account" case this test is about, not a first-time
    // signup that happens to use the sign-in tab.
    await primeClerkPocketBaseLink(PB_URL, clerkUser.id)

    await setupClerkTestingToken({ page })

    await page.goto('/')

    await page.getByRole('button', { name: 'See tonight’s sky', exact: true }).first().click()
    await expect(page).toHaveURL('/app/hub')

    // Guests get Hub; an account-owned area still puts up the gate (ASV-47).
    // Navigated directly rather than via the rail, since onboarding is
    // covering the shell at this point in the journey.
    await page.goto('/app/events')
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()

    await fillClerkSignIn(page, email, password)

    // Signed in, and sent through the current flow -- not waved past it by
    // the account's existing `onboarded` flag.
    await expect(page.getByRole('heading', { name: 'What should Atlas call you?' })).toBeVisible({ timeout: 15_000 })
    await completeOnboarding(page)

    // The flow is an overlay on the route the gate interrupted, so finishing it
    // reveals Events rather than navigating anywhere new.
    await expect(page).toHaveURL('/app/events')
    await expect(page.getByRole('heading', { name: 'Events', exact: true })).toBeVisible({ timeout: 15_000 })
    // The stored marker is a version, not a flag -- see lib/onboarding.ts.
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('atlas-onboarding-flow-complete')))
      .toBe(String(ONBOARDING_VERSION))
  } finally {
    await deleteClerkTestUser({ id: clerkUser.id })
  }
})

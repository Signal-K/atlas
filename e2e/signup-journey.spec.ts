import { expect, test, type Page } from '@playwright/test'
import { setupClerkTestingToken } from '@clerk/testing/playwright'
import { clerkTestEmail, createClerkTestUser, deleteClerkTestUser, fillClerkSignIn, fillClerkSignUp, primeClerkPocketBaseLink } from './support/clerk'

const PB_URL = process.env.VITE_PB_URL || 'http://localhost:8094'

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
    const endsAt = new Date(now.getTime() + 3 * 3_600_000)

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

// "Get started" now requires an account before onboarding or the app shell
// render at all (see AuthGate in App.tsx) -- signup no longer happens
// after a guest has already saved something locally (that whole flow,
// SignupWallModal, was removed as dead code). This proves the new order:
// landing -> auth gate -> account created -> onboarding -> the feature that
// used to require a signup wall (logging an observation) just works.
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

    await expect(page.getByRole('heading', { name: 'What can I see in the sky tonight?' })).toBeVisible()
    await page.getByRole('button', { name: 'Get started' }).click()

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

    // Onboarding runs right after account creation, not before it.
    await expect(page.getByRole('heading', { name: 'What should Atlas call you?' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page.getByRole('heading', { name: 'What do you want to see?' })).toBeVisible()
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page.getByRole('heading', { name: 'Where are you observing from?' })).toBeVisible()
    await page.getByRole('button', { name: 'Looks good' }).click()
    await page.getByRole('button', { name: 'Not now' }).click()

    await expect(page).toHaveURL('/app/events')
    await expect(page.getByRole('heading', { name: 'Events', exact: true })).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'Full Moon' }).click()
    await page.locator('.dt-entry').getByRole('button', { name: 'Log attempt' }).click()

    await expect(page).toHaveURL('/app/journal')
    await expect(page.getByText('Logging attempt for')).toBeVisible()
    await page.getByPlaceholder(/What did you see tonight|How did/).fill('Saw the Moon through thin cloud.')
    await page.getByRole('button', { name: 'Good' }).click()
    await page.getByRole('button', { name: 'Save observation' }).click()

    // A logged attempt carries the event it was logged against, so it lands
    // inside that event's collapsed thread (see EventObservationThread) --
    // has to be opened before its note text is on screen.
    const moonThread = page.locator('.event-thread', { hasText: 'Full Moon' })
    await expect(moonThread.getByRole('button', { name: /Open portfolio/ })).toBeVisible()
    await moonThread.getByRole('button', { name: /Open portfolio/ }).click()
    await expect(moonThread.getByText('Saw the Moon through thin cloud.')).toBeVisible()
  } finally {
    await deleteClerkTestUser({ email })
  }
})

test('an existing account signs in without being sent through onboarding again', async ({ page }) => {
  const email = clerkTestEmail('signup-journey-returning')
  const password = 'Correct-horse-battery1!'
  const clerkUser = await createClerkTestUser(email, password)
  // Establishes the clerk_user_id <-> PocketBase link ahead of time, so the
  // sign-in below is the account's *second* login (created:false) -- the
  // actual "existing account" case this test is about, not a first-time
  // signup that happens to use the sign-in tab.
  await primeClerkPocketBaseLink(PB_URL, clerkUser.id)

  await setupClerkTestingToken({ page })

  try {
    await page.goto('/')

    await page.getByRole('button', { name: 'Get started' }).click()
    await expect(page.getByRole('heading', { name: 'Create your free account' })).toBeVisible()
    await page.getByRole('tab', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()

    await fillClerkSignIn(page, email, password)

    await expect(page.getByRole('heading', { name: 'What should Atlas call you?' })).toHaveCount(0)
    await expect(page).toHaveURL('/app/events')
    await expect(page.getByRole('heading', { name: 'Events', exact: true })).toBeVisible({ timeout: 15_000 })
    await expect.poll(() => page.evaluate(() => localStorage.getItem('atlas-onboarding-flow-complete'))).toBe('1')
  } finally {
    await deleteClerkTestUser({ id: clerkUser.id })
  }
})

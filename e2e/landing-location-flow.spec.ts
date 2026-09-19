import { test, expect, type Page } from '@playwright/test'
import { seedOnboardingComplete, seedSignedInUser } from './support/auth'
import { finishOnboarding, reachOnboardingLocationStep, skipOnboardingQuestions } from './support/onboarding'

const APP_URL = `http://localhost:${process.env.PLAYWRIGHT_PORT || '5173'}`

// STS-307: explicit coverage for the landing page's two entry paths.
// Weather and event calls are mocked so this only tests location -> app
// routing, not live data availability.

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
          cloud_cover_mean: Array(days).fill(12),
          precipitation_probability_mean: Array(days).fill(4),
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
            id: 'e2e-location-moon',
            kind: 'moon_phase',
            target: 'moon',
            title: 'Full Moon',
            description: 'The Moon reaches its fullest point tonight.',
            content: 'The Moon reaches its fullest point tonight.',
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            latitude: 0,
            longitude: 0,
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
}

test.beforeEach(async ({ page }) => {
  await mockTonightData(page)
})

test('index stays on the landing page for a returning signed-out visitor', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => localStorage.setItem('atlas-entered', '1'))
  await seedOnboardingComplete(page)

  await page.goto('/')

  await expect(page).toHaveURL('/')
  await expect(
    page.getByRole('heading', { name: 'Every week the sky puts on something worth walking outside for.' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'See tonight’s sky' }).first()).toBeVisible()
  await expect(page.getByText('Signed in as')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('index stays on the landing page for a signed-in visitor and identifies the session', async ({ page }) => {
  // Same session fixture as every other signed-in spec -- this used to mint its
  // own token and record inline, which is how it ended up seeding the
  // onboarding flag as a bare '1' while the gate had moved on to versions.
  await seedSignedInUser(page, { id: 'e2e-landing-user', email: 'signed-in@example.com', onboardingComplete: true })

  await page.goto('/')

  await expect(page).toHaveURL('/')
  await expect(
    page.getByRole('heading', { name: 'Every week the sky puts on something worth walking outside for.' }),
  ).toBeVisible()
  await expect(page.getByText('Signed in as')).toContainText('signed-in@example.com')
  await expect(page.getByRole('button', { name: 'Open Atlas' }).first()).toBeVisible()
})

// Location is no longer collected on the landing page itself -- it moved
// into OnboardingFlow's "location" step, so it can be asked for after a
// first-time visitor has actually seen what Atlas does, not before. A
// signed-in visitor (seeded above) skips landing entirely -- "/" redirects
// straight to "/app" -- so this goes there directly and clicks past the
// (skippable) name step. The walk itself is shared with the guest specs; see
// e2e/support/onboarding.ts.
async function seedFreshAccountAtLocationStep(page: Page) {
  // Onboarding only runs after authentication. These tests exercise its
  // location step, so seed a newly-created, not-yet-onboarded account here
  // without affecting the returning-account landing-page test above.
  await page.addInitScript(() => localStorage.setItem('atlas-onboarding-flow-required', '1'))
  await seedSignedInUser(page, { onboardingComplete: false })
  await page.goto('/app')
  await reachOnboardingLocationStep(page)
}

// The four question steps and the two closing steps that sit between the
// location step and the app. Shared, so each test's own clicks stay about the
// location behaviour it is actually pinning.
async function finishOnboardingFromQuestions(page: Page) {
  await skipOnboardingQuestions(page)
  await finishOnboarding(page)
}

test('manual city entry reaches tonight feed with selected city', async ({ page }) => {
  await seedFreshAccountAtLocationStep(page)

  await page.getByPlaceholder('Search for your town or city').fill('Zur')
  await expect(page.getByRole('option', { name: /Zurich/ })).toBeVisible()
  await page.getByRole('option', { name: /Zurich/ }).click()
  await page.getByRole('button', { name: 'Use this location' }).click()
  await finishOnboardingFromQuestions(page)

  await expect(page).toHaveURL('/app/hub')
  await expect(page.locator('.az-kicker', { hasText: 'after dark' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Zurich')).toBeVisible()
})

test('browser geolocation entry reaches tonight feed', async ({ page, context }) => {
  await context.grantPermissions(['geolocation'], { origin: APP_URL })
  await context.setGeolocation({ latitude: 47.3769, longitude: 8.5417 })

  // useCurrentLocation shows "Your location" only until reverseGeocodeCity
  // resolves, then swaps in the real place name. Left unmocked this hits
  // api.bigdatacloud.net for real, so the heading raced the network: the
  // generic label if the lookup was slow, "Zurich" if it landed first.
  // Pinning the response makes the settled name deterministic.
  await page.route('https://api.bigdatacloud.net/data/reverse-geocode-client**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ city: 'Zurich', locality: 'Zurich', principalSubdivision: 'Zurich' }),
    })
  })

  await seedFreshAccountAtLocationStep(page)

  await page.getByRole('button', { name: 'Use my current location' }).click()
  await finishOnboardingFromQuestions(page)

  await expect(page).toHaveURL('/app/hub')
  await expect(page.locator('.az-kicker', { hasText: 'after dark' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Zurich')).toBeVisible()
})

// ASV-53: the geolocation branch used to leave nothing durable behind. It
// fired the GPS request without awaiting it and never wrote a home at all, so
// a granted permission produced only geo.ts's 30-day `atlas-location-cache` --
// once that expired the user silently reverted to the hardcoded Melbourne
// default, with no way to tell why. Onboarding now reverse-geocodes the fix
// and persists it through the same store the search path uses.
//
// The reload is what makes this a regression test rather than a restatement of
// the test above: the cache is deleted *and* the browser permission is
// withdrawn, so geolocation cannot quietly re-supply the location a second
// time. Only a persisted home can still answer with Zurich.
test('a geolocation home outlives the geo cache it was derived from', async ({ page, context }) => {
  await context.grantPermissions(['geolocation'], { origin: APP_URL })
  await context.setGeolocation({ latitude: 47.3769, longitude: 8.5417 })
  await page.route('https://api.bigdatacloud.net/data/reverse-geocode-client**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ city: 'Zurich', locality: 'Zurich', principalSubdivision: 'Zurich' }),
    })
  })

  await seedFreshAccountAtLocationStep(page)
  await page.getByRole('button', { name: 'Use my current location' }).click()
  await finishOnboardingFromQuestions(page)
  await expect(page).toHaveURL('/app/hub')
  await expect(page.getByText('Zurich')).toBeVisible({ timeout: 15_000 })

  // The durable half of the fix: a real named home, at the same ~1-degree
  // rounded fix geo.ts caches (47.3769 -> 47.4, 8.5417 -> 8.5).
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('atlas-manual-location') ?? 'null')))
    .toMatchObject({ name: 'Zurich', lat: 47.4, lon: 8.5 })

  // Take away every other way of answering the same question. The flow-required
  // flag is re-seeded on this load, so onboarding reopens -- which is the point:
  // the location step reads its "Current Atlas location" line off a fresh mount
  // with no cache and no permission behind it.
  await context.clearPermissions()
  await page.evaluate(() => localStorage.removeItem('atlas-location-cache'))
  await page.goto('/app')
  await reachOnboardingLocationStep(page)

  await expect(page.getByText('Current Atlas location: Zurich')).toBeVisible()
})

// The other half of the same bug: the old handler cleared the stored home
// *before* the browser had answered, so a denial destroyed the home the user
// already had. The failure is stubbed rather than left to the headless
// browser's default, so "denied" is deterministic here instead of depending on
// how Chromium treats an unanswered permission prompt.
test('a refused location request leaves the existing home untouched', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'atlas-manual-location',
      JSON.stringify({ name: 'London', lat: 51.5074, lon: -0.1278, admin1: 'England', country: 'United Kingdom', timeZone: 'Europe/London' }),
    )
    navigator.geolocation.getCurrentPosition = (_ok, fail) => {
      fail?.({ code: 1, message: 'User denied Geolocation' } as GeolocationPositionError)
    }
  })

  await seedFreshAccountAtLocationStep(page)
  await expect(page.getByText('Current Atlas location: London')).toBeVisible()

  await page.getByRole('button', { name: 'Use my current location' }).click()

  await expect(page.getByText(/We couldn’t get your location/)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Current Atlas location: London')).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('atlas-manual-location') ?? 'null')))
    .toMatchObject({ name: 'London', lat: 51.5074, lon: -0.1278 })
})

// ASV-53: a day covered by two trips resolved to the *soonest*-starting one,
// so flying Perth -> Darwin on the 27th of a 24-27 and a 27-30 trip showed
// Perth -- the city just left, with the wrong forecast for the one arrived in.
// The rule is now latest-start wins, i.e. the newest leg is the one in force.
//
// This asserts the selector the app resolves locations with
// (useCurrentLocation calls activeTripFor on mount and on a timer), against a
// whole table of days rather than just the handover, so an off-by-one at
// either edge of the inclusive range fails here too.
//
// The dates are fixed rather than derived from today: the point is the overlap
// itself, and a handover that only happens to occur when the suite runs on one
// particular calendar day is a test that quietly stops testing anything.
test('a shared handover day resolves to the later trip', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('atlas-manual-location', JSON.stringify({ name: 'Melbourne', lat: -37.8136, lon: 144.9631 }))
    localStorage.setItem(
      'atlas-trips',
      JSON.stringify([
        { id: 'perth', name: 'Perth', lat: -31.9523, lon: 115.8613, startDate: '2026-10-24', endDate: '2026-10-27' },
        { id: 'darwin', name: 'Darwin', lat: -12.4634, lon: 130.8456, startDate: '2026-10-27', endDate: '2026-10-30' },
      ]),
    )
  })

  await page.goto('/')

  const resolved = await page.evaluate(async () => {
    const { activeTripFor } = await import('/src/lib/trips.ts')
    // Midday local, so the day key can't be nudged across a boundary by the
    // runner's offset from UTC.
    const at = (day: string) => activeTripFor(new Date(`${day}T12:00:00`))?.name ?? null
    return {
      before: at('2026-10-23'),
      firstLeg: at('2026-10-25'),
      handover: at('2026-10-27'),
      secondLeg: at('2026-10-28'),
      lastDay: at('2026-10-30'),
      after: at('2026-10-31'),
    }
  })

  expect(resolved).toEqual({
    before: null,
    firstLeg: 'Perth',
    handover: 'Darwin',
    secondLeg: 'Darwin',
    lastDay: 'Darwin',
    after: null,
  })
})

test('location search disambiguates cities by region and country', async ({ page }) => {
  await page.route('https://geocoding-api.open-meteo.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          {
            id: 6058560,
            name: 'London',
            latitude: 42.9834,
            longitude: -81.233,
            admin1: 'Ontario',
            country: 'Canada',
            timezone: 'America/Toronto',
          },
          {
            id: 2643743,
            name: 'London',
            latitude: 51.5074,
            longitude: -0.1278,
            admin1: 'England',
            country: 'United Kingdom',
            timezone: 'Europe/London',
          },
        ],
      }),
    })
  })

  await seedFreshAccountAtLocationStep(page)
  await page.getByPlaceholder('Search for your town or city').fill('London')
  await expect(page.getByRole('option', { name: /London.*Ontario, Canada/ })).toBeVisible()
  await page.getByRole('option', { name: /London.*Ontario, Canada/ }).click()
  await page.getByRole('button', { name: 'Use this location' }).click()
  await finishOnboardingFromQuestions(page)

  await expect(page).toHaveURL('/app/hub')
  await expect(page.locator('.az-kicker', { hasText: 'after dark' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('London, Ontario, Canada')).toBeVisible()
})

test('location switching stays reachable via Settings after onboarding', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  // Overrides the beforeEach's onboardingComplete: false -- this test is
  // about the already-onboarded shell, not the location step itself.
  // ASV-40 put the Settings location search behind Sky Pass
  // (LocationSettings.tsx renders an upgrade prompt in its place for a free
  // account), so the search field this asserts on only exists for an
  // entitled one. The free-account half of that boundary is covered by the
  // test below rather than left implicit.
  await seedSignedInUser(page, { onboardingComplete: true, entitled: true })
  await page.addInitScript(() => {
    localStorage.setItem(
      'atlas-manual-location',
      JSON.stringify({ name: 'London', lat: 51.5074, lon: -0.1278, admin1: 'England', country: 'United Kingdom', timeZone: 'Europe/London' }),
    )
  })

  // Old route, unmatched post-rebuild -- AppShell's catch-all sends it to
  // the new home area instead of erroring.
  await page.goto('/app/today')
  await expect(page).toHaveURL('/app/hub')

  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('dialog', { name: 'Primary navigation' }).getByRole('link', { name: 'You', exact: true }).click()
  await expect(page).toHaveURL('/app/profile')
  await page.getByRole('button', { name: /^Location & sensors/ }).click()
  await expect(page.getByPlaceholder('Search city, region, or country')).toHaveValue('London, England, United Kingdom')
  await page.getByRole('button', { name: 'Close', exact: true }).click()

  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('dialog', { name: 'Primary navigation' }).getByRole('link', { name: 'All events', exact: true }).click()
  await expect(page).toHaveURL('/app/events')
})

test('a free account is offered Sky Pass instead of the Settings location search', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedSignedInUser(page, { onboardingComplete: true })

  await page.goto('/app/profile')
  await page.getByRole('button', { name: /^Location & sensors/ }).click()

  await expect(page.getByPlaceholder('Search city, region, or country')).toHaveCount(0)
  await expect(page.getByText('Free accounts keep the location Atlas detects for you.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Get Sky Pass', exact: true })).toBeVisible()
})

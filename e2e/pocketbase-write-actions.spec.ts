import { expect, test, type Page } from '@playwright/test'
import { setupClerkTestingToken } from '@clerk/testing/playwright'
import { clerkTestEmail, deleteClerkTestUser, fillClerkSignUp, readPocketBaseAuth } from './support/clerk'
import { seedOnboardingComplete } from './support/auth'
import { exifJpeg, strippedJpeg } from './support/exifImage'

test.describe('PocketBase-backed write actions', () => {
  test.skip(
    !process.env.E2E_WRITE_TESTS || !process.env.E2E_WRITE_PB_URL,
    'Requires E2E_WRITE_PB_URL for an existing, non-production PocketBase service with Atlas collections.',
  )

  test('signs up and writes an observation to local PocketBase', async ({ page, request }) => {
    const pbUrl = process.env.E2E_WRITE_PB_URL!
    const email = clerkTestEmail('write-actions')
    const password = `Atlas-e2e-${Date.now()}!`
    const note = `PocketBase write smoke ${Date.now()}`

    await setupClerkTestingToken({ page })

    try {
      const auth = await signUpAndExchange(page, email, password)

      await page.goto('/app/journal')
      await page.getByRole('button', { name: "+ Log tonight's session" }).click()
      await page.locator('textarea').fill(note)
      await page.getByRole('button', { name: 'Save session' }).click()
      await expect(page.getByText(note)).toBeVisible({ timeout: 10_000 })

      // The push to PocketBase is a best-effort, fire-and-forget background
      // sync (see pushObservation in src/lib/sync.ts) that isn't awaited by
      // the Save button before the local "note visible" state above -- so the
      // remote row can land a beat after the UI already shows it locally.
      // Poll instead of a single-shot read.
      let records: Awaited<ReturnType<typeof getObservationRecords>> = { items: [] }
      await expect
        .poll(async () => {
          records = await getObservationRecords(request, pbUrl, auth.token, auth.record.id, note)
          return records.items.length
        }, `Expected a remote atlas_observations row for note "${note}"`)
        .toBe(1)
      expect(records.items[0].note).toBe(note)
    } finally {
      await deleteClerkTestUser({ email })
    }
  })

  // The two halves of the same rule, in one account: a photo that places itself
  // is the user's own evidence and is never queued, while a photo with nothing
  // readable in it has to be reviewed before it counts. They share a signup
  // because the queue-row assertion is about what the *first* path left behind,
  // which only holds if both run against the same user.
  test('backdates a check-in from a photo, then sends an unplaceable one to review', async ({ page, request }) => {
    const pbUrl = process.env.E2E_WRITE_PB_URL!
    const email = clerkTestEmail('backdated-checkin')
    const password = `Atlas-e2e-${Date.now()}!`
    const stamp = Date.now()
    // Distinct notes: they are the only handle the remote rows have on which
    // path wrote them.
    const photoNote = `Perseids from the garden ${stamp}`
    const manualNote = `A faint glow low in the north ${stamp}`
    // A month back -- unambiguously "past", comfortably inside the date input's
    // `max`, and far from the ±3h midnight hedge that would need disambiguating.
    const manualDayKey = localDayKey(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))

    await setupClerkTestingToken({ page })

    try {
      const auth = await signUpAndExchange(page, email, password)
      await page.goto('/app/journal')

      await test.step('a free user cannot backdate without a photo', async () => {
        await page.getByRole('button', { name: 'Check in to a past night' }).click()
        const sheet = pastCheckInSheet(page)
        await expect(sheet).toBeVisible()

        // The inline Sky Pass card, deliberately not the full-screen
        // PaywallGate: a gate that replaced the sheet would throw away the day
        // and place the user had already entered.
        // `exact` throughout: getByText is substring by default, and "See Sky
        // Pass" would otherwise match alongside the kicker.
        await expect(sheet.getByText('Sky Pass', { exact: true })).toBeVisible()
        await expect(sheet.getByText(/needs a photo/)).toBeVisible()
        await expect(sheet.getByRole('button', { name: 'See Sky Pass' })).toBeVisible()
        await expect(sheet.locator('button[type="submit"]')).toBeDisabled()
        // Not merely disabled -- the label must still invite the photo, because
        // with one attached this button is the whole check-in.
        await expect(sheet.getByText('Choose a photo', { exact: true })).toBeVisible()

        await sheet.getByRole('button', { name: 'Close' }).click()
        await expect(sheet).toBeHidden()
      })

      await test.step('a photo that places itself is matched and never queued', async () => {
        await page.getByRole('button', { name: 'Check in to a past night' }).click()
        const sheet = pastCheckInSheet(page)
        await expect(sheet).toBeVisible()

        // 2019-08-12 22:30 +01:00 from London -- the night the Perseids peaked.
        await sheet.locator('#past-checkin-photo').setInputFiles(
          exifJpeg({
            dateTimeOriginal: '2019:08:12 22:30:00',
            offsetTime: '+01:00',
            latitude: 51.5074,
            longitude: -0.1278,
            name: 'perseids.jpg',
          }),
        )

        // The day came out of the photo, not from the user -- asserted on the
        // input because that is what the writer reads.
        await expect(sheet.locator('input[type="date"]')).toHaveValue('2019-08-12', { timeout: 15_000 })
        await expect(sheet.getByText('Taken from the timestamp in your photo.', { exact: true })).toBeVisible()
        await expect(sheet.getByText('From your photo’s GPS', { exact: true })).toBeVisible()

        // A shower is a FLAGSHIP_KIND, so time overlap alone earns `strong` --
        // a meteor frame has no point body for the frame gate to agree with.
        // `first()` because the ranker sorts flagships ahead within the band,
        // so this is the row the pre-selection took; other events that night
        // may legitimately sit below it.
        await expect(sheet.locator('.az-row-title').first()).toHaveText('Perseids Meteor Shower', { timeout: 15_000 })
        await expect(sheet.getByText(/This looks like/)).toBeVisible()

        // `strong` is pre-selected, so the button already offers the check-in
        // rather than asking the user to describe a night we just identified.
        const submit = sheet.locator('button[type="submit"]')
        await expect(submit).toBeEnabled()
        await expect(submit).toHaveText('Check in to this night')

        await sheet.locator('textarea').fill(photoNote)
        await submit.click()

        await expect(sheet).toBeHidden({ timeout: 15_000 })
        await expect(page.getByText(photoNote)).toBeVisible({ timeout: 10_000 })

        // Place the write pipeline before reading the queue: `pushObservation`
        // is a background push, and "no queue row" is only meaningful once the
        // push it would have hung off has actually landed.
        await expect
          .poll(async () => (await getObservationRecords(request, pbUrl, auth.token, auth.record.id, photoNote)).items.length, {
            message: `Expected the photo-matched check-in "${photoNote}" to reach atlas_observations`,
          })
          .toBe(1)

        // The point of this half. `savePastCheckIn` treats a photo with its own
        // GPS, a non-ambiguous EXIF day and a matched event as self-evidenced:
        // reviewStatus 'not_required', and `submitForReview` is never called, so
        // there is no row to approve. A queue row here would mean the writer had
        // started asking a reviewer to confirm what the photo already proved.
        const queued = await getReviewQueueRecords(request, pbUrl, auth.token, photoNote)
        expect(queued.items, 'a self-evidenced check-in must not enter the review queue').toEqual([])

        await openJournalEntry(page, photoNote)
        const detail = page.getByRole('dialog', { name: 'Perseids Meteor Shower' })
        await expect(detail.getByText('BACKDATED')).toBeVisible()
        await expect(detail.getByText(/From your photo’s GPS/)).toBeVisible()
        await expect(detail.getByText(/Sent for review/)).toHaveCount(0)
        await detail.getByRole('button', { name: 'Close' }).click()
      })

      await test.step('a photo with nothing readable is described and sent for review', async () => {
        await page.getByRole('button', { name: 'Check in to a past night' }).click()
        const sheet = pastCheckInSheet(page)
        await expect(sheet).toBeVisible()

        await sheet.locator('#past-checkin-photo').setInputFiles(strippedJpeg())
        // No EXIF at all, so nothing about the day or the place is the photo's
        // to claim -- both inputs have to appear.
        await expect(sheet.locator('input[type="date"]')).toHaveValue('', { timeout: 15_000 })
        await expect(sheet.getByText('You picked this.', { exact: true })).toBeHidden()

        await sheet.locator('input[type="date"]').fill(manualDayKey)
        await expect(sheet.getByText('You picked this.', { exact: true })).toBeVisible()

        // Searched rather than taken from the fallback anchor, so the place is
        // the user's own answer and not a last-resort guess at where they were.
        const place = sheet.locator('#past-checkin-place')
        await place.fill('London')
        await sheet.getByRole('option', { name: /London/ }).first().click()

        await sheet.locator('textarea').fill(manualNote)
        const submit = sheet.locator('button[type="submit"]')
        // Nothing matched, so the description is the only thing a reviewer has.
        await expect(submit).toHaveText('Send for review')
        await expect(submit).toBeEnabled()
        await submit.click()

        await expect(sheet).toBeHidden({ timeout: 15_000 })
        await expect(page.getByText(manualNote)).toBeVisible({ timeout: 10_000 })

        // Polled, not single-shot: the queue row is created after the
        // observation push and the photo upload, both of which are background.
        let queued: Awaited<ReturnType<typeof getReviewQueueRecords>> = { items: [] }
        await expect
          .poll(
            async () => {
              queued = await getReviewQueueRecords(request, pbUrl, auth.token, manualNote)
              return queued.items.length
            },
            `Expected a review-queue row for the unplaceable check-in "${manualNote}"`,
          )
          .toBe(1)
        expect(queued.items[0].status).toBe('pending')
        // The day the *user* picked, not one derived from the photo's instant.
        expect(queued.items[0].day_key).toBe(manualDayKey)
        expect(queued.items[0].location_label).toContain('London')

        await openJournalEntry(page, manualNote)
        const detail = page.getByRole('dialog', { name: 'Entry' })
        await expect(detail.getByText('BACKDATED')).toBeVisible()
        // Amber, and the only place the user learns their entry is not yet
        // counting toward a city stamp.
        await expect(detail.getByText(/Sent for review/)).toBeVisible()
        await detail.getByRole('button', { name: 'Close' }).click()
      })
    } finally {
      await deleteClerkTestUser({ email })
    }
  })
})

// Signing up and exchanging the Clerk session for a PocketBase one. Shared
// because three copies of this would drift, and the trap it encodes (see the
// `.settings-account-email` wait below) is not one to rediscover.
async function signUpAndExchange(page: Page, email: string, password: string) {
  // Signing up flips `alreadyEntered`, which would otherwise surface the
  // first-run OnboardingFlow overlay and block the Scrapbook tab click below --
  // these tests aren't testing onboarding, so mark it done upfront.
  await seedOnboardingComplete(page)
  await page.goto('/app/settings')

  await page.getByRole('tab', { name: 'Create account' }).click()
  await fillClerkSignUp(page, email, password)
  // Profile opens on the row list, Account is a sub-page reached by row.
  await page.getByRole('button', { name: /^Account/ }).click()
  // Clerk's own "Verify your email" step also renders the email as plain text,
  // so `getByText(email)` alone would pass before the exchange has actually
  // run -- wait for the Account sub-page's own post-exchange element instead.
  await expect(page.locator('.settings-account-email')).toHaveText(email, { timeout: 15_000 })

  const auth = await readPocketBaseAuth(page)
  if (!auth) throw new Error('Expected pb.authStore to hold a token after the Clerk exchange completed.')
  return auth
}

/** Scoped by the Sheet's own `aria-label`, so its rows can't be confused with the journal's. */
function pastCheckInSheet(page: Page) {
  return page.getByRole('dialog', { name: 'Check in to a past night' })
}

/** Journal rows are `.az-row`; the note is the only handle that distinguishes them. */
async function openJournalEntry(page: Page, note: string) {
  await page.locator('.az-row').filter({ hasText: note }).click()
}

/** Local, not UTC: the date input's `max` and the day keys it stores are local. */
function localDayKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

async function getObservationRecords(request: import('@playwright/test').APIRequestContext, pbUrl: string, token: string, userId: string, note: string) {
  const url = new URL(`${pbUrl}/api/collections/atlas_observations/records`)
  url.searchParams.set('filter', `user = "${userId}" && note = "${note}"`)
  const response = await request.get(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(response.ok(), await response.text()).toBe(true)
  return (await response.json()) as { items: Array<{ id: string; note: string }> }
}

/**
 * Read with the user's own token, not an admin one.
 *
 * The collection's five rules are all `user = @request.auth.id`, deliberately
 * narrower than the photo-challenge collection's approved-or-mine rule -- these
 * rows are private location data. So this read doubles as a check that the rules
 * let an owner see their own submission, and that they let nobody see another's.
 */
async function getReviewQueueRecords(request: import('@playwright/test').APIRequestContext, pbUrl: string, token: string, note: string) {
  const url = new URL(`${pbUrl}/api/collections/atlas_checkin_review_queue/records`)
  url.searchParams.set('filter', `note = "${note}"`)
  const response = await request.get(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(response.ok(), await response.text()).toBe(true)
  return (await response.json()) as {
    items: Array<{ id: string; status: string; day_key: string; location_label: string }>
  }
}

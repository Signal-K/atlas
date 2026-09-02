import { expect, test, type Page } from '@playwright/test'
import { seedSignedInUser } from './support/auth'

declare global {
  interface Window {
    __atlasNotifications?: Array<{ title: string; body?: string; tag?: string }>
  }
}

async function mockReminderData(page: Page) {
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
          cloud_cover_mean: Array(days).fill(8),
          precipitation_probability_mean: Array(days).fill(2),
        },
      }),
    })
  })

  await page.route('**/api/collections/sky_events/records**', async (route) => {
    const now = new Date()
    // isVisibleFromLocation() (src/lib/eventVisibility.mjs) gates moon_phase
    // events on the Moon actually being above the horizon during the event
    // window, sampled at 7 points across it. A short 1-hour window pinned to
    // "now" made this flaky: whether the Moon is up at lat/lon 0 depends on
    // the real wall-clock time the suite happens to run at. A window longer
    // than one full moonrise-to-moonset cycle (~24-25h) is guaranteed to
    // contain a visible sample regardless of when CI runs.
    const startsAt = now
    const endsAt = new Date(now.getTime() + 30 * 3_600_000)

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'e2e-reminder-moon',
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

async function mockNotifications(page: Page) {
  await page.addInitScript(() => {
    window.__atlasNotifications = []

    class MockNotification {
      static permission: NotificationPermission = 'default'

      static async requestPermission() {
        MockNotification.permission = 'granted'
        return MockNotification.permission
      }

      constructor(title: string, options?: NotificationOptions) {
        window.__atlasNotifications?.push({
          title,
          body: options?.body,
          tag: options?.tag,
        })
      }
    }

    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: MockNotification,
    })

    // scheduleReminder() (src/lib/getReadyReminders.ts) shows local
    // reminders via the service worker's showNotification() when one is
    // available -- new Notification() throws on nearly all mobile
    // browsers, so that's the path production actually takes. No service
    // worker ever activates for this test page, so without this stub
    // `navigator.serviceWorker.ready` hangs forever and the reminder
    // never appears to fire. Mocked to record into the same
    // __atlasNotifications array the MockNotification class above uses.
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({
          showNotification: (title: string, options?: NotificationOptions) => {
            window.__atlasNotifications?.push({
              title,
              body: options?.body,
              tag: options?.tag,
            })
            return Promise.resolve()
          },
        }),
      },
    })
  })
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockNotifications(page)
  await mockReminderData(page)
})

test('mobile signed-in user can arm an event reminder', async ({ page }) => {
  await seedSignedInUser(page)
  await page.addInitScript(() => {
    localStorage.setItem(
      'atlas-manual-location',
      JSON.stringify({ name: 'London', lat: 51.5074, lon: -0.1278, admin1: 'England', country: 'United Kingdom', timeZone: 'Europe/London' }),
    )
  })
  await page.goto('/app/events')

  // The Events redesign replaced the old "reported" dashboard heading.
  // Wait for the mocked event itself: it is the actual prerequisite for the
  // reminder interaction and keeps this test independent of page chrome.
  // Today's events now surface twice on purpose -- once in the "Today's
  // events" preview, once in the full "All events" list below it -- so
  // match whichever "Full Moon" renders first rather than assuming one.
  await expect(page.getByRole('button', { name: /Full Moon/ }).first()).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /Full Moon/ }).first().click()
  await page.getByRole('button', { name: 'Remind' }).click()

  await expect(page.getByText('Reminder armed.')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const reminders = JSON.parse(window.localStorage.getItem('atlas-get-ready-reminders') ?? '[]')
        return reminders[0]
      }),
    )
    .toMatchObject({
      eventId: 'e2e-reminder-moon',
      title: 'Full Moon',
      kind: 'moon_phase',
      target: 'moon',
      deviceName: expect.any(String),
      cloudCoverPct: 8,
      precipitationChancePct: 2,
    })
})

test('local reminder fires weather-checked notification copy', async ({ page }) => {
  await page.goto('/')

  const reminder = await page.evaluate(async () => {
    const { addGetReadyReminder, ensureNotificationPermission } = await import('/src/lib/getReadyReminders.ts')
    const startsAt = new Date(Date.now() + 250)
    const endsAt = new Date(startsAt.getTime() + 45 * 60_000)
    await ensureNotificationPermission()
    return addGetReadyReminder({
      eventId: 'e2e-visible-jupiter',
      title: 'Jupiter',
      kind: 'planet_event',
      target: 'jupiter',
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      deviceName: 'iPhone 15 Pro',
      lat: -37.8136,
      lon: 144.9631,
      directionLabel: 'south',
      cloudCoverPct: 80,
      precipitationChancePct: 60,
    })
  })

  await expect
    .poll(() => page.evaluate(() => window.__atlasNotifications?.[0]), { timeout: 5_000 })
    .toMatchObject({
      title: 'Atlas: get ready',
      tag: 'atlas-e2e-visible-jupiter',
      body: expect.stringContaining('Jupiter is visible now for about 45 minutes. clear sky, 8% cloud. Look south. Set up iPhone 15 Pro.'),
    })
  await expect
    .poll(() =>
      page.evaluate((reminderId) => {
        const reminders = JSON.parse(window.localStorage.getItem('atlas-get-ready-reminders') ?? '[]')
        return reminders.find((item: { id: string }) => item.id === reminderId)
      }, reminder.id),
    )
    .toMatchObject({ eventId: 'e2e-visible-jupiter', firedAt: expect.any(String) })
  await expect(
    page.evaluate((reminderId) => {
      const reminders = JSON.parse(window.localStorage.getItem('atlas-get-ready-reminders') ?? '[]')
      const reminder = reminders.find((item: { id: string }) => item.id === reminderId)
      return Object.prototype.hasOwnProperty.call(reminder, 'skippedReason')
    }, reminder.id),
  ).resolves.toBe(false)
})

test('post-window reminder feedback updates the sighting profile and unlocks harder targets', async ({ page }) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const { getSightingProfile, listPendingReminderFeedback, recordReminderFeedback } = await import('/src/lib/getReadyReminders.ts')
    const now = Date.now()
    window.localStorage.setItem(
      'atlas-get-ready-reminders',
      JSON.stringify([
        {
          id: 'past-moon',
          eventId: 'past-moon-event',
          title: 'Full Moon',
          kind: 'moon_phase',
          target: 'moon',
          startsAt: new Date(now - 2 * 60 * 60_000).toISOString(),
          endsAt: new Date(now - 60 * 60_000).toISOString(),
          remindAt: new Date(now - 3 * 60 * 60_000).toISOString(),
          deviceName: 'iPhone 15 Pro',
          createdAt: new Date(now - 4 * 60 * 60_000).toISOString(),
        },
        {
          id: 'past-jupiter',
          eventId: 'past-jupiter-event',
          title: 'Jupiter',
          kind: 'planet_event',
          target: 'jupiter',
          startsAt: new Date(now - 90 * 60_000).toISOString(),
          endsAt: new Date(now - 30 * 60_000).toISOString(),
          remindAt: new Date(now - 2 * 60 * 60_000).toISOString(),
          deviceName: 'iPhone 15 Pro',
          createdAt: new Date(now - 3 * 60 * 60_000).toISOString(),
        },
      ]),
    )

    const pendingBefore = listPendingReminderFeedback().map((item) => item.id)
    recordReminderFeedback('past-moon', { outcome: 'saw_it', note: 'Bright and clear.' })
    recordReminderFeedback('past-jupiter', { outcome: 'saw_it' })

    return {
      pendingBefore,
      pendingAfter: listPendingReminderFeedback().map((item) => item.id),
      profile: getSightingProfile(),
    }
  })

  expect(result.pendingBefore).toEqual(['past-moon', 'past-jupiter'])
  expect(result.pendingAfter).toEqual([])
  expect(result.profile.targets.moon.confirmed).toBe(1)
  expect(result.profile.targets.jupiter.confirmed).toBe(1)
  expect(result.profile.kinds.moon_phase.confirmed).toBe(1)
  expect(result.profile.kinds.planet_event.confirmed).toBe(1)
  expect(result.profile.harderTargetsUnlockedAt).toEqual(expect.any(String))
})

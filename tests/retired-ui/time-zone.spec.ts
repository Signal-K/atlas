import { expect, test } from '@playwright/test'
import { tonightWindowForTimeZone } from '../src/lib/timeZone'
import { getDarknessWindow } from '../src/lib/darknessWindow'
import { findNextClearWindow, localDateKey, type DailyViewingAdvisory } from '../src/lib/weather'

test('tonight ends at six in the selected location rather than the browser timezone', () => {
  const now = new Date('2026-07-21T20:00:00.000Z')

  expect(tonightWindowForTimeZone(now, 'Europe/London').end.toISOString()).toBe('2026-07-22T05:00:00.000Z')
  expect(tonightWindowForTimeZone(now, 'Australia/Melbourne').end.toISOString()).toBe('2026-07-22T20:00:00.000Z')
})

test('after-midnight sessions end at the upcoming six o clock, not a day later', () => {
  const now = new Date('2026-07-21T02:00:00.000Z')

  expect(tonightWindowForTimeZone(now, 'Europe/London').end.toISOString()).toBe('2026-07-21T05:00:00.000Z')
})

// The Hub's "Sunset" tile used to render civilDuskAt, which is 40+ minutes
// after real sunset at London's latitude in midsummer -- reported as the
// sunset times "looking off" for London.
test('sunset is the real horizon crossing, well before civil dusk', () => {
  const start = new Date('2026-07-28T12:00:00.000Z')
  const end = new Date('2026-07-29T05:00:00.000Z')

  const window = getDarknessWindow(51.5074, -0.1278, start, end)
  const at = (iso: string | null) =>
    iso === null
      ? null
      : new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Europe/London',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(iso))

  expect(at(window.sunsetAt)).toBe('20:54')
  expect(at(window.civilDuskAt)).toBe('21:36')
  expect(at(window.astronomicalDuskAt)).toBe('23:56')
})

test('event dates follow the observing location rather than UTC', () => {
  const nearUtcMidnight = '2026-08-03T23:30:00.000Z'

  expect(localDateKey(nearUtcMidnight, 'Australia/Perth')).toBe('2026-08-04')
  expect(localDateKey(nearUtcMidnight, 'America/Los_Angeles')).toBe('2026-08-03')
})

test('better-night selection rejects a clear but rain-soaked forecast', () => {
  const day = (date: string, cloudCoverPct: number, precipitationChancePct: number): DailyViewingAdvisory => ({
    date,
    cloudCoverPct,
    precipitationChancePct,
    quality: cloudCoverPct < 30 ? 'clear' : cloudCoverPct < 70 ? 'partly-cloudy' : 'cloudy',
  })
  const forecast = [
    day('2026-08-03', 90, 10),
    day('2026-08-04', 5, 100),
    day('2026-08-05', 40, 5),
  ]

  expect(findNextClearWindow(forecast)?.date).toBe('2026-08-05')
})

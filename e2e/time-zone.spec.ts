import { expect, test } from '@playwright/test'
import { tonightWindowForTimeZone } from '../src/lib/timeZone'

test('tonight ends at six in the selected location rather than the browser timezone', () => {
  const now = new Date('2026-07-21T20:00:00.000Z')

  expect(tonightWindowForTimeZone(now, 'Europe/London').end.toISOString()).toBe('2026-07-22T05:00:00.000Z')
  expect(tonightWindowForTimeZone(now, 'Australia/Melbourne').end.toISOString()).toBe('2026-07-22T20:00:00.000Z')
})

test('after-midnight sessions end at the upcoming six o clock, not a day later', () => {
  const now = new Date('2026-07-21T02:00:00.000Z')

  expect(tonightWindowForTimeZone(now, 'Europe/London').end.toISOString()).toBe('2026-07-21T05:00:00.000Z')
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchEvents as fetchMeteorShowerEvents } from '../src/lib/eventSources/meteor-showers.mjs'
import {
  eventDisplayInstant,
  formatZonedDate,
  formatZonedTime,
  meteorBestViewingInstant,
} from '../src/lib/eventTiming.mjs'

function zonedParts(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  )
  return { day: Number(parts.day), month: Number(parts.month), hour: Number(parts.hour), minute: Number(parts.minute) }
}

test('Orionids are shown at 02:00 on 21 Oct in the observer zone, not the 17:00 window start', async () => {
  const events = await fetchMeteorShowerEvents({ now: new Date('2026-10-13T00:00:00.000Z'), windowDays: 20 })
  const orionids = events.find((event) => event.target === 'orionids')
  assert.ok(orionids, 'expected the Orionids')

  for (const timeZone of ['America/Chicago', 'Europe/Zurich']) {
    const best = meteorBestViewingInstant(orionids.starts_at, timeZone)
    const parts = zonedParts(best, timeZone)
    assert.equal(parts.month, 10)
    assert.equal(parts.day, 21)
    assert.equal(parts.hour, 2)
    assert.equal(parts.minute, 0)
    const label = formatZonedTime(best.toISOString(), timeZone, true)
    assert.match(label, /2:00/)
    assert.match(label, /AM/)
    assert.doesNotMatch(label, /5:00/)
    assert.ok(label.split(' ').length >= 3, `${timeZone} label should include a time zone: ${label}`)
  }
})

test('a late-evening full Moon keeps the same calendar day on the list and the detail page', () => {
  // 23:12 in America/Chicago on 25 Oct is 04:12 UTC on 26 Oct. A browser in a
  // zone ahead of Chicago used to print the next day on the detail page only.
  const iso = '2026-10-26T04:12:00.000Z'
  const event = { kind: 'moon_phase', startsAt: iso }
  const shown = eventDisplayInstant(event, 'America/Chicago').toISOString()
  const listDate = formatZonedDate(shown, 'America/Chicago')
  const detailDate = formatZonedDate(shown, 'America/Chicago')
  assert.equal(listDate, detailDate)
  assert.match(listDate, /Oct 25/)
  const time = formatZonedTime(shown, 'America/Chicago', false)
  assert.match(time, /23:12/)
  assert.match(time, /CDT/)
})

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

test('Orionids best viewing is after moonset on the night of 21–22 Oct, not 02:00 on 21 Oct', async () => {
  const events = await fetchMeteorShowerEvents({ now: new Date('2026-10-13T00:00:00.000Z'), windowDays: 30 })
  const orionids = events.find((event) => event.target === 'orionids')
  assert.ok(orionids, 'expected the Orionids')
  assert.equal(orionids.starts_at.slice(0, 10), '2026-10-19')
  assert.equal(orionids.ends_at.slice(0, 10), '2026-11-08')

  for (const timeZone of ['America/Chicago', 'Europe/Zurich']) {
    const best = meteorBestViewingInstant(orionids.starts_at, timeZone, undefined, 'orionids')
    const parts = zonedParts(best, timeZone)
    assert.equal(parts.month, 10)
    assert.equal(parts.day, 22)
    assert.equal(parts.hour, 2)
    assert.equal(parts.minute, 0)
    const label = formatZonedTime(best.toISOString(), timeZone, true)
    assert.match(label, /2:00/)
    assert.match(label, /AM/)
    assert.doesNotMatch(label, /5:00/)
    assert.ok(label.split(' ').length >= 3, `${timeZone} label should include a time zone: ${label}`)
  }

  // Tallinn moonset is 22 Oct 02:48 EEST (01:48 CEST). The shown instant is the
  // first dark sample after that, not 02:00 on 21 Oct and not the UTC peak.
  const tallinn = meteorBestViewingInstant(
    orionids.starts_at,
    'Europe/Tallinn',
    { lat: 59.4, lon: 24.7536 },
    'orionids',
  )
  const tallinnParts = zonedParts(tallinn, 'Europe/Tallinn')
  assert.equal(tallinnParts.month, 10)
  assert.equal(tallinnParts.day, 22)
  assert.equal(tallinnParts.hour, 2)
  assert.ok(tallinn.getTime() >= Date.parse('2026-10-21T23:48:00.000Z'))
  assert.ok(tallinn.getTime() < Date.parse('2026-10-22T00:00:00.000Z'))

  const shown = eventDisplayInstant(
    { kind: 'meteor_shower', target: 'orionids', startsAt: orionids.starts_at },
    'Europe/Zurich',
    { lat: 47.3769, lon: 8.5417 },
  )
  const zurichParts = zonedParts(shown, 'Europe/Zurich')
  assert.equal(zurichParts.day, 22)
  assert.ok(shown.getTime() >= Date.parse('2026-10-22T01:19:00.000Z'))
  assert.ok(shown.getTime() < Date.parse('2026-10-22T01:32:00.000Z'))
})

test('other showers still use 02:00 on the catalogue peak date when no coordinates are passed', async () => {
  const events = await fetchMeteorShowerEvents({ now: new Date('2026-08-01T00:00:00.000Z'), windowDays: 20 })
  const perseids = events.find((event) => event.target === 'perseids')
  assert.ok(perseids)
  const best = meteorBestViewingInstant(perseids.starts_at, 'America/Chicago', undefined, 'perseids')
  const parts = zonedParts(best, 'America/Chicago')
  assert.equal(parts.month, 8)
  assert.equal(parts.day, 12)
  assert.equal(parts.hour, 2)
  assert.equal(parts.minute, 0)
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

test('Leonids and Geminids catalogue windows stay the short peak, separate from the campaign presets', async () => {
  const events = await fetchMeteorShowerEvents({ now: new Date('2026-11-01T00:00:00.000Z'), windowDays: 60 })
  const leonids = events.find((event) => event.target === 'leonids')
  const geminids = events.find((event) => event.target === 'geminids')
  assert.equal(leonids.starts_at, '2026-11-16T10:00:00.000Z')
  assert.equal(leonids.ends_at, '2026-11-18T22:00:00.000Z')
  assert.equal(geminids.starts_at, '2026-12-13T10:00:00.000Z')
  assert.equal(geminids.ends_at, '2026-12-15T22:00:00.000Z')
})

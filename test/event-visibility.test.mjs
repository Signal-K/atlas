import assert from 'node:assert/strict'
import test from 'node:test'
import { visibilityForEvent } from '../src/lib/eventVisibility.mjs'

const CITIES = {
  Zurich: [47.3769, 8.5417],
  Reykjavik: [64.1466, -21.9426],
  Melbourne: [-37.8136, 144.9631],
  Santiago: [-33.4489, -70.6693],
}

const lunarEclipse = {
  kind: 'eclipse',
  target: 'moon',
  startsAt: '2026-08-28T02:42:49.076Z',
  endsAt: '2026-08-28T05:42:49.076Z',
}

test('lunar eclipse visibility differs by city and hemisphere/time zone', () => {
  assert.equal(visibilityForEvent(lunarEclipse, ...CITIES.Zurich).visible, true)
  assert.equal(visibilityForEvent(lunarEclipse, ...CITIES.Reykjavik).visible, true)
  assert.equal(visibilityForEvent(lunarEclipse, ...CITIES.Melbourne).visible, false)
  assert.equal(visibilityForEvent(lunarEclipse, ...CITIES.Santiago).visible, true)
})

test('the August 2026 solar eclipse is not globally visible', () => {
  const event = {
    kind: 'eclipse',
    target: 'sun',
    startsAt: '2026-08-12T16:15:46.794Z',
    endsAt: '2026-08-12T19:15:46.794Z',
  }
  assert.equal(visibilityForEvent(event, ...CITIES.Zurich).visible, true)
  assert.equal(visibilityForEvent(event, ...CITIES.Melbourne).visible, false)
  assert.equal(visibilityForEvent(event, ...CITIES.Santiago).visible, false)
})

test('Perseids require darkness and a radiant above the horizon', () => {
  const event = {
    kind: 'meteor_shower',
    target: 'perseids',
    startsAt: '2026-08-11T10:00:00Z',
    endsAt: '2026-08-13T22:00:00Z',
  }
  assert.equal(visibilityForEvent(event, ...CITIES.Zurich).visible, true)
  assert.equal(visibilityForEvent(event, ...CITIES.Melbourne).visible, false)
})

// ASV-39: point events (starts_at === ends_at) were only sampled at that one
// instant, so a real conjunction whose exact peak fell in daylight was hidden
// from a place that saw it fine in the evening twilight either side of it.
test('a zero-duration Moon-Venus conjunction stays visible from Perth on 2026-09-14', async () => {
  const { fetchEvents } = await import('../src/lib/eventSources/conjunctions.mjs')
  const events = await fetchEvents({ now: new Date('2026-09-10T00:00:00.000Z'), windowDays: 14 })
  const found = events.find((e) => e.target === 'moon_venus')
  assert.ok(found, 'expected the Moon-Venus conjunction')
  const event = { kind: found.kind, target: found.target, startsAt: found.starts_at, endsAt: found.ends_at }
  assert.equal(event.startsAt, event.endsAt, 'fixture must stay zero-duration')
  assert.equal(visibilityForEvent(event, -31.9523, 115.8613).visible, true)
})

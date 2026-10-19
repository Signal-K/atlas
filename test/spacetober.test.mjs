import assert from 'node:assert/strict'
import test from 'node:test'
import { orionidsActivity } from '../src/lib/eventSources/meteor-showers.mjs'
import {
  AFTER_MOONSET_MARKER,
  ATLAS_ORIONIDS_URL,
  ATLAS_SOURCE,
  FIREBALL_EVENT_ID,
  LANDNAM_ORIONIDS_URL,
  ORIONIDS_EVENT_ID,
  SPACETOBER_EVENT_ID,
  SUBJECT_CHECK_IN,
  SUBJECT_PHOTO,
  SUBJECT_READING,
  SUBJECT_STAMP,
  awardsForObservation,
  badgeLabel,
  fireballAward,
  isAfterMoonsetCheckIn,
  orionidsPhase,
  quizIsCorrect,
  raisesMeteoriteMastery,
  spacetoberStripVisible,
} from '../src/lib/spacetober.mjs'

const activity = orionidsActivity(2026)

test('the Orionids activity window runs from 2 Oct through 7 Nov, peak 21 Oct', () => {
  assert.equal(activity.startsAt, '2026-10-02T00:00:00.000Z')
  assert.equal(activity.endsAt, '2026-11-07T23:59:59.000Z')
  assert.equal(activity.peakAt, '2026-10-21T04:00:00.000Z')
  assert.equal(orionidsPhase(new Date('2026-10-01T12:00:00.000Z'), 'Europe/Tallinn', activity), 'before')
  assert.equal(orionidsPhase(new Date('2026-10-02T12:00:00.000Z'), 'America/Chicago', activity), 'during')
  assert.equal(orionidsPhase(new Date('2026-11-07T08:00:00.000Z'), 'Pacific/Auckland', activity), 'during')
  assert.equal(orionidsPhase(new Date('2026-11-08T12:00:00.000Z'), 'Europe/Zurich', activity), 'after')
})

test('a photo during the window is gold Orionids and a Spacetober stamp, and raises mastery', () => {
  const rows = awardsForObservation({
    at: new Date('2026-10-21T20:00:00.000Z'),
    timeZone: 'Europe/Tallinn',
    hasPhoto: true,
    activity,
  })
  const photo = rows.find((row) => row.event_id === ORIONIDS_EVENT_ID && row.subject_id === SUBJECT_PHOTO)
  assert.equal(photo.tier, 'gold')
  assert.equal(photo.source, ATLAS_SOURCE)
  assert.equal(photo.earned_at, Date.parse('2026-10-21T20:00:00.000Z'))
  assert.equal(photo.marker, '')
  assert.equal(photo.voucher, '')
  assert.equal(photo.grantsMastery, true)
  assert.ok(rows.some((row) => row.event_id === SPACETOBER_EVENT_ID && row.subject_id === SUBJECT_STAMP && row.tier === 'gold' && row.source === ATLAS_SOURCE))
  assert.equal(raisesMeteoriteMastery(rows), true)
  assert.equal(badgeLabel(ORIONIDS_EVENT_ID, 'gold'), 'Orionids 2026')
})

test('the same photo after the window is silver late and still raises mastery', () => {
  const rows = awardsForObservation({
    at: new Date('2026-11-10T18:00:00.000Z'),
    timeZone: 'Europe/Tallinn',
    hasPhoto: true,
    activity,
  })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].event_id, ORIONIDS_EVENT_ID)
  assert.equal(rows[0].subject_id, SUBJECT_PHOTO)
  assert.equal(rows[0].tier, 'silver')
  assert.equal(rows[0].source, ATLAS_SOURCE)
  assert.equal(rows[0].grantsMastery, true)
  assert.match(badgeLabel(ORIONIDS_EVENT_ID, 'silver'), /Silver · late/)
})

test('a photo before the window earns nothing', () => {
  const rows = awardsForObservation({
    at: new Date('2026-09-30T18:00:00.000Z'),
    timeZone: 'Europe/Tallinn',
    hasPhoto: true,
    activity,
  })
  assert.deepEqual(rows, [])
})

test('a check-in without a photo stamps Spacetober and does not raise mastery', () => {
  const rows = awardsForObservation({
    at: new Date('2026-10-07T18:00:00.000Z'),
    timeZone: 'Europe/London',
    hasPhoto: false,
    activity,
  })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].event_id, SPACETOBER_EVENT_ID)
  assert.equal(rows[0].subject_id, SUBJECT_STAMP)
  assert.equal(rows[0].source, ATLAS_SOURCE)
  assert.equal(rows[0].tier, 'gold')
  assert.equal(raisesMeteoriteMastery(rows), false)
})

test('a check-in after 02:00 local on 22 Oct sets after_moonset, including before Tallinn moonset', () => {
  // 02:10 EEST is 23:10 UTC on 21 Oct — before the 02:48 EEST moonset.
  const early = new Date('2026-10-21T23:10:00.000Z')
  assert.equal(isAfterMoonsetCheckIn(early, 'Europe/Tallinn', activity), true)
  const rows = awardsForObservation({ at: early, timeZone: 'Europe/Tallinn', hasPhoto: false, activity })
  const flag = rows.find((row) => row.subject_id === SUBJECT_CHECK_IN && row.event_id === ORIONIDS_EVENT_ID)
  assert.equal(flag.tier, 'gold')
  assert.equal(flag.source, ATLAS_SOURCE)
  assert.equal(flag.marker, AFTER_MOONSET_MARKER)
  assert.equal(flag.voucher, '')
  assert.equal(flag.grantsMastery, false)

  assert.equal(isAfterMoonsetCheckIn(new Date('2026-10-21T22:30:00.000Z'), 'Europe/Tallinn', activity), false)
  assert.equal(isAfterMoonsetCheckIn(new Date('2026-10-22T09:30:00.000Z'), 'Europe/Tallinn', activity), false)
})

test('Fireball Spotter needs the reading plus the quiz or a 10-minute watch', () => {
  const during = new Date('2026-10-22T01:00:00.000Z')
  assert.equal(fireballAward({ at: during, timeZone: 'UTC', activity, read: false, quizCorrect: true }), null)
  assert.equal(fireballAward({ at: during, timeZone: 'UTC', activity, read: true, quizCorrect: false, watchMinutes: 9, meteorCount: 3 }), null)
  const gold = fireballAward({ at: during, timeZone: 'UTC', activity, read: true, quizCorrect: true })
  assert.equal(gold.event_id, FIREBALL_EVENT_ID)
  assert.equal(gold.subject_id, SUBJECT_READING)
  assert.equal(gold.tier, 'gold')
  assert.equal(gold.source, ATLAS_SOURCE)
  assert.equal(gold.earned_at, during.getTime())
  assert.equal(gold.grantsMastery, true)
  const watched = fireballAward({
    at: during,
    timeZone: 'UTC',
    activity,
    read: true,
    quizCorrect: false,
    watchMinutes: 10,
    meteorCount: 0,
  })
  assert.equal(watched.tier, 'gold')
  const late = fireballAward({
    at: new Date('2026-12-01T00:00:00.000Z'),
    timeZone: 'UTC',
    activity,
    read: true,
    quizCorrect: true,
  })
  assert.equal(late.tier, 'silver')
  assert.match(badgeLabel(FIREBALL_EVENT_ID, 'silver'), /Silver · late/)
  assert.equal(fireballAward({ at: new Date('2026-09-01T00:00:00.000Z'), timeZone: 'UTC', activity, read: true, quizCorrect: true }), null)
  assert.equal(quizIsCorrect([0, 1, 1]), true)
  assert.equal(quizIsCorrect([1, 1, 1]), false)
})

test('the strip is up for October through 7 Nov and the Landnam link carries UTM', () => {
  assert.equal(spacetoberStripVisible(new Date('2026-10-01T12:00:00.000Z'), 'UTC', activity), true)
  assert.equal(spacetoberStripVisible(new Date('2026-09-30T12:00:00.000Z'), 'UTC', activity), false)
  assert.equal(spacetoberStripVisible(new Date('2026-11-07T12:00:00.000Z'), 'UTC', activity), true)
  assert.match(LANDNAM_ORIONIDS_URL, /utm_source=atlas/)
  assert.match(LANDNAM_ORIONIDS_URL, /utm_campaign=spacetober-orionids/)
  assert.match(LANDNAM_ORIONIDS_URL, /from=atlas-orionids/)
  assert.equal(ATLAS_ORIONIDS_URL, 'https://youratlas.cc/orionids')
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { orionidsActivity } from '../src/lib/eventSources/meteor-showers.mjs'
import {
  AFTER_MOONSET_MARKER,
  ATLAS_ORIONIDS_URL,
  ATLAS_SOURCE,
  FIREBALL_EVENT_ID,
  LANDNAM_ORIONIDS_URL,
  GEMINIDS_EVENT_ID,
  LEONIDS_EVENT_ID,
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
  liveShowerCampaign,
  masteryGrant,
  nextMasteryLevel,
  orionidsPhase,
  quizIsCorrect,
  raisesMeteoriteMastery,
  showerCampaigns,
  spacetoberStripVisible,
} from '../src/lib/spacetober.mjs'

const activity = orionidsActivity(2026)

test('the Orionids gold window runs from 19 Oct through 8 Nov, peak 21 Oct', () => {
  assert.equal(activity.startsAt, '2026-10-19T00:00:00.000Z')
  assert.equal(activity.endsAt, '2026-11-08T23:59:59.000Z')
  assert.equal(activity.peakAt, '2026-10-21T04:00:00.000Z')
  assert.equal(orionidsPhase(new Date('2026-10-18T12:00:00.000Z'), 'Europe/Tallinn', activity), 'before')
  assert.equal(orionidsPhase(new Date('2026-10-19T12:00:00.000Z'), 'America/Chicago', activity), 'during')
  assert.equal(orionidsPhase(new Date('2026-11-08T08:00:00.000Z'), 'Pacific/Auckland', activity), 'during')
  assert.equal(orionidsPhase(new Date('2026-11-08T12:00:00.000Z'), 'Europe/Zurich', activity), 'during')
  assert.equal(orionidsPhase(new Date('2026-11-09T12:00:00.000Z'), 'Europe/Zurich', activity), 'after')
  const orionids = showerCampaigns(activity).find((campaign) => campaign.eventId === ORIONIDS_EVENT_ID)
  assert.equal(orionids.goldStart, '2026-10-19')
  assert.equal(orionids.goldEnd, '2026-11-08')
  assert.match(orionids.bannerRest, /8 November/)
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
  assert.equal(photo.masteryLevel, 1)
  assert.equal(rows.some((row) => row.event_id === LEONIDS_EVENT_ID || row.event_id === GEMINIDS_EVENT_ID), false)
  assert.ok(rows.some((row) => row.event_id === SPACETOBER_EVENT_ID && row.subject_id === SUBJECT_STAMP && row.tier === 'gold' && row.source === ATLAS_SOURCE))
  assert.equal(raisesMeteoriteMastery(rows), true)
  assert.deepEqual(masteryGrant(rows), { level: 1, event_id: ORIONIDS_EVENT_ID, earned_at: Date.parse('2026-10-21T20:00:00.000Z') })
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

test('Leonids and Geminids stay inactive until their dates, then follow the same gold and silver rules', () => {
  const onTwentieth = awardsForObservation({
    at: new Date('2026-10-20T12:00:00.000Z'),
    timeZone: 'UTC',
    hasPhoto: true,
    activity,
  })
  assert.equal(onTwentieth.some((row) => row.event_id === LEONIDS_EVENT_ID || row.event_id === GEMINIDS_EVENT_ID), false)
  assert.equal(liveShowerCampaign(new Date('2026-10-20T12:00:00.000Z'), 'UTC', activity).eventId, ORIONIDS_EVENT_ID)
  assert.equal(liveShowerCampaign(new Date('2026-11-10T12:00:00.000Z'), 'UTC', activity), null)

  const beforeLeonids = awardsForObservation({
    at: new Date('2026-11-16T12:00:00.000Z'),
    timeZone: 'UTC',
    hasPhoto: true,
    activity,
  })
  assert.equal(beforeLeonids.some((row) => row.event_id === LEONIDS_EVENT_ID), false)

  const leonidsNight = awardsForObservation({
    at: new Date('2026-11-17T12:00:00.000Z'),
    timeZone: 'UTC',
    hasPhoto: true,
    activity,
  })
  const leonids = leonidsNight.find((row) => row.event_id === LEONIDS_EVENT_ID)
  assert.equal(leonids.subject_id, SUBJECT_PHOTO)
  assert.equal(leonids.tier, 'gold')
  assert.equal(leonids.source, ATLAS_SOURCE)
  assert.equal(leonids.marker, '')
  assert.equal(leonids.voucher, '')
  assert.equal(leonids.masteryLevel, 2)
  assert.equal(leonidsNight.find((row) => row.event_id === ORIONIDS_EVENT_ID && row.subject_id === SUBJECT_PHOTO).tier, 'silver')
  assert.equal(liveShowerCampaign(new Date('2026-11-17T12:00:00.000Z'), 'UTC', activity).eventId, LEONIDS_EVENT_ID)
  assert.deepEqual(masteryGrant(leonidsNight), {
    level: 2,
    event_id: LEONIDS_EVENT_ID,
    earned_at: Date.parse('2026-11-17T12:00:00.000Z'),
  })
  assert.equal(badgeLabel(LEONIDS_EVENT_ID, 'gold'), 'Leonids 2026')

  const afterLeonids = awardsForObservation({
    at: new Date('2026-11-18T12:00:00.000Z'),
    timeZone: 'UTC',
    hasPhoto: true,
    activity,
  })
  assert.equal(afterLeonids.find((row) => row.event_id === LEONIDS_EVENT_ID).tier, 'silver')
  assert.match(badgeLabel(LEONIDS_EVENT_ID, 'silver'), /Silver · late/)
  assert.equal(liveShowerCampaign(new Date('2026-11-18T12:00:00.000Z'), 'UTC', activity), null)

  const beforeGeminids = awardsForObservation({
    at: new Date('2026-12-12T12:00:00.000Z'),
    timeZone: 'UTC',
    hasPhoto: true,
    activity,
  })
  assert.equal(beforeGeminids.some((row) => row.event_id === GEMINIDS_EVENT_ID), false)

  for (const iso of ['2026-12-13T12:00:00.000Z', '2026-12-14T12:00:00.000Z']) {
    const rows = awardsForObservation({ at: new Date(iso), timeZone: 'UTC', hasPhoto: true, activity })
    const geminids = rows.find((row) => row.event_id === GEMINIDS_EVENT_ID)
    assert.equal(geminids.tier, 'gold')
    assert.equal(geminids.subject_id, SUBJECT_PHOTO)
    assert.equal(geminids.source, ATLAS_SOURCE)
    assert.equal(geminids.masteryLevel, 3)
    assert.equal(rows.find((row) => row.event_id === LEONIDS_EVENT_ID).tier, 'silver')
    assert.equal(liveShowerCampaign(new Date(iso), 'UTC', activity).eventId, GEMINIDS_EVENT_ID)
    assert.equal(masteryGrant(rows).level, 3)
    assert.equal(masteryGrant(rows).event_id, GEMINIDS_EVENT_ID)
  }

  const afterGeminids = awardsForObservation({
    at: new Date('2026-12-15T12:00:00.000Z'),
    timeZone: 'UTC',
    hasPhoto: true,
    activity,
  })
  assert.equal(afterGeminids.find((row) => row.event_id === GEMINIDS_EVENT_ID).tier, 'silver')
  assert.match(badgeLabel(GEMINIDS_EVENT_ID, 'silver'), /Silver · late/)
  assert.equal(liveShowerCampaign(new Date('2026-12-15T12:00:00.000Z'), 'UTC', activity), null)
  assert.equal(nextMasteryLevel(1, 1), null)
  assert.equal(nextMasteryLevel(5, 2), null)
  assert.equal(nextMasteryLevel(1, 2), 2)
  assert.equal(nextMasteryLevel(2, 3), 3)
})

test('a photo during World Space Week before 19 Oct stamps Spacetober and skips Orionids', () => {
  const rows = awardsForObservation({
    at: new Date('2026-10-07T18:00:00.000Z'),
    timeZone: 'Europe/London',
    hasPhoto: true,
    activity,
  })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].event_id, SPACETOBER_EVENT_ID)
  assert.equal(rows[0].subject_id, SUBJECT_STAMP)
})

test('the strip is up for October through 8 Nov and the Landnam link carries UTM', () => {
  assert.equal(spacetoberStripVisible(new Date('2026-10-01T12:00:00.000Z'), 'UTC', activity), true)
  assert.equal(spacetoberStripVisible(new Date('2026-09-30T12:00:00.000Z'), 'UTC', activity), false)
  assert.equal(spacetoberStripVisible(new Date('2026-11-08T12:00:00.000Z'), 'UTC', activity), true)
  assert.equal(spacetoberStripVisible(new Date('2026-11-09T12:00:00.000Z'), 'UTC', activity), false)
  assert.match(LANDNAM_ORIONIDS_URL, /utm_source=atlas/)
  assert.match(LANDNAM_ORIONIDS_URL, /utm_campaign=spacetober-orionids/)
  assert.match(LANDNAM_ORIONIDS_URL, /from=atlas-orionids/)
  assert.equal(ATLAS_ORIONIDS_URL, 'https://youratlas.cc/orionids')
})

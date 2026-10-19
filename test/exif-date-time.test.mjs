// The photo -> civil day arithmetic.
//
// Every case here is a story about a real photo, because the failure mode this
// guards is invisible: a mis-dated entry still saves, it is just filed under a
// night that never happened.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  deriveOffset,
  naiveUtcMs,
  parseExifDateTime,
  parseGpsUtcPair,
  parseOffsetMinutes,
  resolvePhotoDay,
} from '../src/lib/exifDateTime.mjs'

const PERTH_LON = 115.8613
const LONDON_LON = -0.1278

test('EXIF datetime parses its own colon-separated format', () => {
  assert.deepEqual(parseExifDateTime('2026:09:14 18:29:57'), { y: 2026, mo: 9, d: 14, h: 18, mi: 29, s: 57 })
  // Not "2026-09-14" -- EXIF uses ':' in the date portion too, which is why
  // new Date(raw) cannot be used.
  assert.equal(parseExifDateTime('2026-09-14 18:29:57'), null)
  assert.equal(parseExifDateTime(undefined), null)
  assert.equal(parseExifDateTime('2026:13:14 18:29:57'), null, 'month 13 is not a month')
})

test('offsets parse in both written forms', () => {
  assert.equal(parseOffsetMinutes('+08:00'), 480)
  assert.equal(parseOffsetMinutes('-05:30'), -330)
  assert.equal(parseOffsetMinutes('+0800'), 480, 'the colon-less form exists in the wild')
  assert.equal(parseOffsetMinutes('Z'), null)
  assert.equal(parseOffsetMinutes(null), null)
})

test('the naive reading keeps its digits regardless of the machine timezone', () => {
  const parsed = parseExifDateTime('2026:09:14 18:29:57')
  assert.equal(naiveUtcMs(parsed), Date.UTC(2026, 8, 14, 18, 29, 57))
  assert.equal(naiveUtcMs(null), null)
})

test('the GPS pair is a true UTC instant', () => {
  assert.equal(parseGpsUtcPair('2026:09:14', [10, 29, 57]), Date.UTC(2026, 8, 14, 10, 29, 57))
  assert.equal(parseGpsUtcPair('2026:09:14', ['10', '29', '57']), Date.UTC(2026, 8, 14, 10, 29, 57))
  assert.equal(parseGpsUtcPair('nonsense', [10, 29, 57]), null)
  assert.equal(parseGpsUtcPair('2026:09:14', null), null)
})

test('an explicit EXIF offset wins over everything else', () => {
  const naive = Date.UTC(2026, 8, 14, 18, 29, 57)
  const gpsUtc = Date.UTC(2026, 8, 14, 22, 29, 57) // deliberately contradictory
  const result = deriveOffset({ explicitOffsetMinutes: 480, naiveUtcMs: naive, gpsUtcMs: gpsUtc, longitudeDeg: LONDON_LON })

  assert.deepEqual(result, { offsetMinutes: 480, offsetSource: 'exif-offset' })
})

test('the GPS pair recovers the offset the camera never wrote', () => {
  // The common case: a phone writes GPS but no OffsetTimeOriginal. Wall clock
  // 18:29:57 local, true instant 10:29:57Z -> +8h.
  const naive = Date.UTC(2026, 8, 14, 18, 29, 57)
  const gpsUtc = Date.UTC(2026, 8, 14, 10, 29, 57)
  const result = deriveOffset({ naiveUtcMs: naive, gpsUtcMs: gpsUtc, longitudeDeg: PERTH_LON })

  assert.equal(result.offsetSource, 'gps-utc-pair')
  assert.equal(result.offsetMinutes, 480)
})

test('the GPS-derived offset snaps to a quarter hour', () => {
  // Real offsets are on 15-minute boundaries; a literal subtraction lands a
  // second or two off because neither EXIF field is written to sub-second
  // precision.
  const naive = Date.UTC(2026, 8, 14, 18, 29, 57)
  const gpsUtc = Date.UTC(2026, 8, 14, 10, 29, 58) // 1s of clock skew
  assert.equal(deriveOffset({ naiveUtcMs: naive, gpsUtcMs: gpsUtc }).offsetMinutes, 480)
})

test('longitude is the last resort and is only ever an approximation', () => {
  assert.deepEqual(deriveOffset({ longitudeDeg: PERTH_LON }), { offsetMinutes: 480, offsetSource: 'longitude' })
  assert.deepEqual(deriveOffset({ longitudeDeg: LONDON_LON }), { offsetMinutes: 0, offsetSource: 'longitude' })
  assert.deepEqual(deriveOffset({}), { offsetMinutes: null, offsetSource: 'unknown' })
})

test('a photo with no timestamp has no day, and says so', () => {
  const result = resolvePhotoDay({ naiveUtcMs: null })

  assert.equal(result.dayKey, null)
  assert.equal(result.dayKeyAlt, null)
  assert.equal(result.source, 'user')
  assert.equal(result.ambiguous, false)
})

test('an exact offset gives an unhesitating answer', () => {
  // 18:29 local on the 14th, camera said +08:00, GPS agrees it was in Perth.
  const result = resolvePhotoDay({
    naiveUtcMs: Date.UTC(2026, 8, 14, 18, 29, 57),
    offsetMinutes: 480,
    offsetSource: 'exif-offset',
    longitudeDeg: PERTH_LON,
  })

  assert.equal(result.dayKey, '2026-09-14')
  assert.equal(result.source, 'exif')
  assert.equal(result.ambiguous, false, 'mid-evening, an exact offset, nothing to hedge')
  assert.equal(result.dayKeyAlt, null)
})

test('a late-evening photo with an inexact offset is hedged, not guessed', () => {
  // 23:40 local, offset only known to within a few hours: 3h either way lands
  // on a different civil day, so the user has to say which.
  const result = resolvePhotoDay({
    naiveUtcMs: Date.UTC(2026, 8, 14, 23, 40, 0),
    offsetMinutes: 480,
    offsetSource: 'gps-utc-pair',
    longitudeDeg: PERTH_LON,
  })

  assert.equal(result.dayKey, '2026-09-14')
  assert.equal(result.ambiguous, true)
  assert.equal(result.dayKeyAlt, '2026-09-15', 'the other side of midnight')
})

test('an early-morning photo is hedged back to the previous day', () => {
  const result = resolvePhotoDay({
    naiveUtcMs: Date.UTC(2026, 8, 14, 1, 20, 0),
    offsetMinutes: 480,
    offsetSource: 'longitude',
    longitudeDeg: PERTH_LON,
  })

  assert.equal(result.ambiguous, true)
  assert.equal(result.dayKeyAlt, '2026-09-13')
})

test('the middle of the day is never ambiguous', () => {
  const result = resolvePhotoDay({
    naiveUtcMs: Date.UTC(2026, 8, 14, 12, 0, 0),
    offsetMinutes: 480,
    offsetSource: 'longitude',
    longitudeDeg: PERTH_LON,
  })

  assert.equal(result.ambiguous, false)
  assert.equal(result.dayKeyAlt, null)
})

test('a camera still on home time is caught by disagreeing with the photo location', () => {
  // A Perth camera (still on +08:00) taken to London. Wall clock says
  // 2026-09-15 02:30, and +08:00 puts the true instant at 2026-09-14 18:30Z --
  // which is still 2026-09-14 in London. The date the diary wants is the 14th,
  // and the camera's own answer of the 15th is offered as the alternative.
  const result = resolvePhotoDay({
    naiveUtcMs: Date.UTC(2026, 8, 15, 2, 30, 0),
    offsetMinutes: 480,
    offsetSource: 'exif-offset',
    longitudeDeg: LONDON_LON,
  })

  assert.equal(result.dayKey, '2026-09-14', 'the day it was where the photo was taken')
  assert.equal(result.dayKeyAlt, '2026-09-15')
  assert.equal(result.ambiguous, true, 'the two zones disagree, so never pick silently')
})

// Which civil day was this photo taken on, and at what instant?
//
// This is the highest-risk arithmetic in the backdated-check-in feature and
// the reason it lives in a separate pure .mjs rather than inside
// exifExtract.ts: getting it wrong files a real night under the wrong date,
// and the failure is invisible -- the entry still saves, it is just wrong.
// Being pure means test/exif-date-time.test.mjs can pin every branch.
//
// The trap this is built around: DateTimeOriginal is the camera's *local wall
// clock*, in whatever zone the camera's clock was set to -- which is not
// necessarily the zone the photo was taken in. A traveller whose camera never
// left home time writes a wall clock that is hours off from the place they
// were standing. Three sources of truth, best first:
//
//   1. OffsetTimeOriginal  -- the camera said its own UTC offset. Exact.
//   2. GPSDateStamp+GPSTimeStamp -- a true UTC instant, which recovers the
//      offset by comparing it against the wall clock.
//   3. Longitude -- round(lon/15) hours. An approximation, and politically
//      wrong wherever a country's offset differs from its meridian (India,
//      China, Spain, Argentina), but far better than the browser's zone.
//
// When the answer is a judgement call the caller is told so rather than being
// handed a confident guess: `ambiguous` plus a second candidate day drives a
// two-chip "was it the 14th or the 15th?" prompt in the sheet.

const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

// The window around local midnight where a +/-3h offset error flips the civil
// date. 21:00-03:00 is 3h either side of midnight: a photo at 22:30 could be
// 19:30 or 01:30 elsewhere, which are different days.
const AMBIGUOUS_START_HOUR = 21
const AMBIGUOUS_END_HOUR = 3

/**
 * EXIF's own datetime format is "2026:09:14 18:29:57" -- colons in the date
 * portion too, so this can never be handed to `new Date(...)` directly.
 * @returns {{ y: number, mo: number, d: number, h: number, mi: number, s: number } | null}
 */
export function parseExifDateTime(raw) {
  if (typeof raw !== 'string') return null
  const match = raw.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
  if (!match) return null
  const [, y, mo, d, h, mi, s] = match.map(Number)
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 60) return null
  return { y, mo, d, h, mi, s }
}

/**
 * "+08:00" / "-05:30" -> minutes east of UTC. Null for anything else.
 * @returns {number | null}
 */
export function parseOffsetMinutes(raw) {
  if (typeof raw !== 'string') return null
  const match = raw.match(/^([+-])(\d{2}):?(\d{2})$/)
  if (!match) return null
  const [, sign, h, m] = match
  const minutes = Number(h) * 60 + Number(m)
  return sign === '-' ? -minutes : minutes
}

/**
 * The naive wall-clock reading as if it were UTC.
 *
 * Reading the components as UTC on purpose: this is a *local* time whose
 * offset is not yet known, so the only safe thing to do is hold its digits
 * still and apply the offset later. Passing it to `new Date(...)` would let
 * the browser's own zone silently reinterpret it -- the exact bug that made
 * an earlier revision of exifExtract.ts wrong for a traveller's photos.
 * @returns {number | null}
 */
export function naiveUtcMs(parsed) {
  if (!parsed) return null
  return Date.UTC(parsed.y, parsed.mo - 1, parsed.d, parsed.h, parsed.mi, parsed.s)
}

/**
 * GPSDateStamp ("YYYY:MM:DD") + GPSTimeStamp ([h, m, s], always UTC) -> the
 * true UTC instant. This is the one EXIF field pair that cannot be wrong about
 * the timezone, because it is not expressed in a local zone at all.
 *
 * exifr's exact shape for GPSTimeStamp depends on reviveValues, so each
 * component is accepted as a number or a numeric string.
 * @returns {number | null}
 */
export function parseGpsUtcPair(dateStamp, timeStamp) {
  if (typeof dateStamp !== 'string') return null
  const date = dateStamp.match(/^(\d{4}):(\d{2}):(\d{2})/)
  if (!date) return null
  if (!Array.isArray(timeStamp) || timeStamp.length < 2) return null
  const parts = timeStamp.map((value) => (typeof value === 'number' ? value : Number(value)))
  if (parts.some((value) => !Number.isFinite(value))) return null
  const [h, mi, s = 0] = parts
  if (h > 23 || mi > 59 || s > 60) return null
  const [, y, mo, d] = date.map(Number)
  return Date.UTC(y, mo - 1, d, h, mi, s)
}

/**
 * Add zero to turn a negative zero into a positive one.
 *
 * `Math.round(-0.1278 / 15) * 60` is `-0`: a longitude just west of Greenwich
 * rounds to zero hours and the sign survives. It is the same number in every
 * arithmetic sense, but `Object.is(-0, 0)` is false, so it shows up as a diff in
 * a test, and it is the kind of value that makes a downstream `=== 0` check
 * behave surprisingly. Offsets are stored, so normalise at the source.
 */
function positiveZero(value) {
  return value + 0
}

/** Round to the nearest 15 minutes, the granularity real offsets are on. */
function snapToQuarterHour(ms) {
  return Math.round(ms / (15 * MINUTE_MS)) * (15 * MINUTE_MS)
}

/** Wrap a millisecond offset into the range real UTC offsets live in. */
function clampToRealOffsets(ms) {
  const limit = 14 * HOUR_MS
  if (ms > limit) return ms - 24 * HOUR_MS
  if (ms < -12 * HOUR_MS) return ms + 24 * HOUR_MS
  return ms
}

/**
 * The camera's UTC offset, from the best evidence available.
 *
 * @param {{
 *   explicitOffsetMinutes?: number | null,
 *   naiveUtcMs?: number | null,
 *   gpsUtcMs?: number | null,
 *   longitudeDeg?: number | null,
 * }} input
 * @returns {{ offsetMinutes: number | null, offsetSource: 'exif-offset' | 'gps-utc-pair' | 'longitude' | 'unknown' }}
 */
export function deriveOffset({ explicitOffsetMinutes = null, naiveUtcMs: naive = null, gpsUtcMs = null, longitudeDeg = null }) {
  if (explicitOffsetMinutes != null) {
    return { offsetMinutes: positiveZero(explicitOffsetMinutes), offsetSource: 'exif-offset' }
  }
  // The GPS pair is a true instant, so the wall clock minus it *is* the offset.
  // Snapped to a quarter hour because neither field is written to sub-second
  // precision and a literal subtraction lands a second or two off.
  if (naive != null && gpsUtcMs != null) {
    return {
      offsetMinutes: positiveZero(clampToRealOffsets(snapToQuarterHour(naive - gpsUtcMs)) / MINUTE_MS),
      offsetSource: 'gps-utc-pair',
    }
  }
  // round(lon/15) hours. An approximation -- see the module header.
  if (longitudeDeg != null) {
    return { offsetMinutes: positiveZero(Math.round(longitudeDeg / 15) * 60), offsetSource: 'longitude' }
  }
  return { offsetMinutes: null, offsetSource: 'unknown' }
}

/** 'YYYY-MM-DD' for an instant that has already been shifted into the target zone. */
function civilDateKey(shiftedMs) {
  return new Date(shiftedMs).toISOString().slice(0, 10)
}

function shiftDay(dayKey, days) {
  return civilDateKey(Date.parse(`${dayKey}T00:00:00.000Z`) + days * DAY_MS)
}

/**
 * The civil day a photo belongs to, and how sure we are of it.
 *
 * @param {{
 *   naiveUtcMs?: number | null,
 *   offsetMinutes?: number | null,
 *   offsetSource?: 'exif-offset' | 'gps-utc-pair' | 'longitude' | 'unknown',
 *   longitudeDeg?: number | null,
 * }} input
 * @returns {{
 *   dayKey: string | null,
 *   dayKeyAlt: string | null,
 *   source: 'exif' | 'gps' | 'longitude' | 'user',
 *   ambiguous: boolean,
 *   utcMs: number | null,
 *   localHour: number | null,
 * }}
 */
export function resolvePhotoDay({ naiveUtcMs: naive = null, offsetMinutes = null, offsetSource = 'unknown', longitudeDeg = null }) {
  // Case 4: no usable timestamp at all. The user picks the day; nothing here
  // may invent one.
  if (naive == null) {
    return { dayKey: null, dayKeyAlt: null, source: 'user', ambiguous: false, utcMs: null, localHour: null }
  }

  const source = offsetSource === 'exif-offset' ? 'exif' : offsetSource === 'gps-utc-pair' ? 'gps' : 'longitude'
  // The camera's own zone, so the wall clock reads back as the naive date.
  // Falls back to the naive reading with no shift when the offset is unknown.
  const cameraOffset = offsetMinutes ?? 0
  const utcMs = naive - cameraOffset * MINUTE_MS

  // The day the *camera* thought it was. Always a candidate, and exact when
  // the camera's offset came from EXIF.
  const cameraDayKey = civilDateKey(naive)

  // The day it was *where the photo was taken*, which is what a diary means.
  // Only differs from the camera's day when the camera clock was set to
  // another zone -- and that disagreement is worth surfacing on its own,
  // regardless of how close to midnight the photo was.
  const locationOffset = longitudeDeg != null ? Math.round(longitudeDeg / 15) * 60 : cameraOffset
  const locationDayKey = civilDateKey(utcMs + locationOffset * MINUTE_MS)

  const localHour = new Date(utcMs + locationOffset * MINUTE_MS).getUTCHours()

  // Two independent reasons to hedge, and either is enough:
  //  - the camera's zone and the photo's zone disagree about the date;
  //  - the offset is not exact (cases 2-3) and the local wall clock sits close
  //    enough to midnight that a +/-3h error would move it to another day.
  const zonesDisagree = locationDayKey !== cameraDayKey
  const nearMidnight = offsetSource !== 'exif-offset'
    && (localHour >= AMBIGUOUS_START_HOUR || localHour < AMBIGUOUS_END_HOUR)
  const ambiguous = zonesDisagree || nearMidnight

  let dayKeyAlt = null
  if (zonesDisagree) {
    // The two zones are the two real answers; offer both.
    dayKeyAlt = cameraDayKey
  } else if (nearMidnight) {
    // One side of midnight or the other, decided by which side we are on.
    dayKeyAlt = localHour >= AMBIGUOUS_START_HOUR ? shiftDay(locationDayKey, 1) : shiftDay(locationDayKey, -1)
  }

  return { dayKey: locationDayKey, dayKeyAlt, source, ambiguous, utcMs, localHour }
}

// Spacetober 2026 campaign rules. Pure functions so the web app, tests, and
// the PocketBase writer share one definition of the Orionids window, the
// gold/silver tiers, and the joint after-moonset marker.
//
// Rows match Signal-K/planet-hunters-experiment-1
// pocketbase/pb_migrations/1780713200_event_badges.js. See
// docs/spacetober-shared-schema.md.
//   event_badges: event_id, tier, source, earned_at (unix ms), subject_id, marker, voucher
//   meteorite_mastery: one row per user — level, source, event_id, earned_at

import { orionidsActivity } from './eventSources/meteor-showers.mjs'

export const ORIONIDS_EVENT_ID = 'orionids-2026'
export const SPACETOBER_EVENT_ID = 'spacetober-2026'
export const FIREBALL_EVENT_ID = 'fireball-spotter-2026'
export const ATLAS_SOURCE = 'atlas'
export const SUBJECT_PHOTO = 'photo'
export const SUBJECT_CHECK_IN = 'check-in'
export const SUBJECT_STAMP = 'stamp'
export const SUBJECT_READING = 'reading-activity'
// Joint-badge flag on event_badges.marker. Landnam's own planet finds use
// marker "orionids-found" and voucher "owned"; Atlas does not write those.
export const AFTER_MOONSET_MARKER = 'after-moonset'

// Stable public path. /orionids redirects to the guest-open /app/orionids page.
export const ATLAS_ORIONIDS_PATH = '/orionids'
export const ATLAS_ORIONIDS_URL = 'https://youratlas.cc/orionids'

export const LANDNAM_ORIONIDS_URL =
  'https://playlandnam.space/?utm_source=atlas&utm_medium=campaign&utm_campaign=spacetober-orionids&from=atlas-orionids'

export const FIREBALLS_SOURCE_URL = 'https://fireballsinthesky.com.au/'

// World Space Week is always 4–10 October.
const SPACE_WEEK_START = '2026-10-04'
const SPACE_WEEK_END = '2026-10-10'
// The hub strip stays up from the start of October through the Orionids close.
const STRIP_START = '2026-10-01'

export const FIREBALL_QUIZ = [
  {
    prompt: 'What is the difference between a meteor and a meteorite?',
    choices: [
      'A meteor is the streak of light in the air. A meteorite is the rock that reaches the ground.',
      'They are two names for the same flash of light.',
      'A meteorite is the light, and a meteor is the orbit the rock had in space.',
    ],
    correct: 0,
  },
  {
    prompt: 'How does the Desert Fireball Network work out where a rock might have landed?',
    choices: [
      'One camera guesses a direction and a team searches the whole state.',
      'Several cameras see the same fireball, the path is triangulated, and a fall line is calculated.',
      'A satellite weighs the meteor and texts the nearest town.',
    ],
    correct: 1,
  },
  {
    prompt: 'What should a report to Fireballs in the Sky include?',
    choices: [
      'Only a star rating of how pretty it looked.',
      'The time, how long it lasted, and the direction it travelled, sent through the app or the website.',
      'A weather forecast for the next morning.',
    ],
    correct: 1,
  },
]

export function quizIsCorrect(selected) {
  return (
    Array.isArray(selected) &&
    selected.length === FIREBALL_QUIZ.length &&
    FIREBALL_QUIZ.every((question, index) => selected[index] === question.correct)
  )
}

export function civilParts(date, timeZone) {
  const zone = timeZone || 'UTC'
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    key: `${parts.year}-${parts.month}-${parts.day}`,
  }
}

function utcDateKey(iso) {
  return String(iso).slice(0, 10)
}

export function orionidsPhase(date, timeZone, activity = orionidsActivity(2026)) {
  const { key } = civilParts(date, timeZone)
  if (key < utcDateKey(activity.startsAt)) return 'before'
  if (key > utcDateKey(activity.endsAt)) return 'after'
  return 'during'
}

export function orionidsLive(date, timeZone, activity) {
  return orionidsPhase(date, timeZone, activity) === 'during'
}

export function spacetoberStripVisible(date, timeZone, activity = orionidsActivity(2026)) {
  const { key } = civilParts(date, timeZone)
  return key >= STRIP_START && key <= utcDateKey(activity.endsAt)
}

function inSpaceWeek(key) {
  return key >= SPACE_WEEK_START && key <= SPACE_WEEK_END
}

// Joint-badge flag. This is a campaign threshold, not the computed moonset:
// local civil time on 22 Oct of the peak year, from 02:00 inclusive until
// noon exclusive. Tallinn's moon sets at 02:48 EEST that morning (01:48
// CEST); a 02:10 check-in still counts.
export function isAfterMoonsetCheckIn(date, timeZone, activity = orionidsActivity(2026)) {
  const parts = civilParts(date, timeZone)
  // Peak catalogue date is 21 Oct; the flag morning is 22 Oct local.
  const flagKey = `${activity.year}-10-22`
  return parts.key === flagKey && parts.hour >= 2 && parts.hour < 12
}

function badge(eventId, subjectId, tier, at, grantsMastery, marker = '') {
  return {
    event_id: eventId,
    subject_id: subjectId,
    tier,
    source: ATLAS_SOURCE,
    earned_at: at.getTime(),
    marker,
    voucher: '',
    grantsMastery,
  }
}

export function awardsForObservation({ at, timeZone, hasPhoto, activity = orionidsActivity(2026) }) {
  const when = at instanceof Date ? at : new Date(at)
  const phase = orionidsPhase(when, timeZone, activity)
  const parts = civilParts(when, timeZone)
  const rows = []

  if (hasPhoto && phase !== 'before') {
    rows.push(badge(ORIONIDS_EVENT_ID, SUBJECT_PHOTO, phase === 'during' ? 'gold' : 'silver', when, true))
  }

  if (inSpaceWeek(parts.key) || phase === 'during') {
    rows.push(badge(SPACETOBER_EVENT_ID, SUBJECT_STAMP, 'gold', when, false))
  }

  if (isAfterMoonsetCheckIn(when, timeZone, activity)) {
    rows.push(badge(ORIONIDS_EVENT_ID, SUBJECT_CHECK_IN, 'gold', when, false, AFTER_MOONSET_MARKER))
  }

  return rows
}

export function fireballAward({
  at,
  timeZone,
  activity = orionidsActivity(2026),
  read,
  quizCorrect,
  watchMinutes,
  meteorCount,
}) {
  if (!read) return null
  const watchOk = Number.isFinite(watchMinutes) && watchMinutes >= 10 && Number.isFinite(meteorCount) && meteorCount >= 0
  if (!quizCorrect && !watchOk) return null
  const when = at instanceof Date ? at : new Date(at)
  const phase = orionidsPhase(when, timeZone, activity)
  if (phase === 'before') return null
  return badge(FIREBALL_EVENT_ID, SUBJECT_READING, phase === 'during' ? 'gold' : 'silver', when, true)
}

export function badgeLabel(eventId, tier) {
  if (eventId === ORIONIDS_EVENT_ID) return tier === 'gold' ? 'Orionids 2026' : 'Orionids 2026 · Silver · late'
  if (eventId === FIREBALL_EVENT_ID) return tier === 'gold' ? 'Fireball Spotter' : 'Fireball Spotter · Silver · late'
  if (eventId === SPACETOBER_EVENT_ID) return 'Spacetober'
  return eventId
}

export function raisesMeteoriteMastery(rows) {
  return rows.some((row) => row.grantsMastery)
}

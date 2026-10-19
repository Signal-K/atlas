// The ranker behind "which real event was this photo of?".
//
// Every fixture here was produced by running the real generators on the real
// date rather than hand-written, so a change to a generator surfaces here as a
// failing expectation instead of a silently different candidate set.
//
// Note on the plan's test 2. It was written as "Heading 180 degrees away ->
// possible", which contradicts the plan's own stronger rule a few lines above
// it: "Heading orders, never rejects". The stronger rule wins -- a wrong or
// rotated GPSImgDirection must not be able to rule out the correct event -- so
// the heading tests below assert it stays `strong` and that heading only ever
// reorders equal candidates.
import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchPastEventsForDay } from '../src/lib/pastEvents.mjs'
import { rankPastEventCandidates } from '../src/lib/pastCheckInMatch.mjs'

const PERTH = { lat: -31.9523, lon: 115.8613 }
const LONDON = { lat: 51.5074, lon: -0.1278 }

// The full-moon fixture day, chosen for two timezone reasons rather than an
// astronomy one.
//
// First, `fetchPastEventsForDay` pads its window either side of *local* midnight,
// and local midnight can only be produced in the zone the process happens to be
// running in -- so what the generated day contains depends on that zone. A full
// moon appears at every offset only when it falls inside
// [dayKeyT00:00Z - 12h, dayKeyT00:00Z + 16h], the intersection of the windows
// that every offset from -12 to +14 builds. The original fixture, 2026-07-01,
// read fine in AWST and failed in CI: its full moon is 2026-06-29T23:57:17.744Z,
// three minutes *before* the UTC window opens.
//
// Second, gate B only passes a moon_phase when the Moon clears the horizon at
// some hourly sample in [peak - 6h, peak + 6h] as seen from the observer, so the
// peak has to land in Perth's night as well as in that band. 2026-10-26 sits
// inside the band and still ranks `none` here for exactly this reason.
//
// 2026-04-02 is the one day found that satisfies both with room to spare: its
// peak, 02:12:36.809Z, is 2.21h into a band centred on +2h, and the full moon is
// the day's only generated event at all 29 whole-hour offsets from -12 to +14 --
// so candidates[0] below is unambiguous wherever this runs.
const FULL_MOON_DAY = '2026-04-02'

/** identifySky()'s result shape, built by hand to control which bodies are "seen". */
function identified({ aboveHorizon = [], objects = [], closestPair = null } = {}) {
  return { aboveHorizon, objects, closestPair }
}

test('a Moon-pointed photo on a full-moon night is a strong match', async () => {
  const events = await fetchPastEventsForDay(FULL_MOON_DAY)
  const fullMoon = events.find((event) => event.title === 'Full Moon')

  assert.ok(fullMoon, 'expected the full moon in the generated day')
  assert.equal(fullMoon.kind, 'moon_phase')

  const instant = new Date(new Date(fullMoon.startsAt).getTime() + 20 * 60_000)
  const result = rankPastEventCandidates(events, {
    ...PERTH,
    instant,
    identified: identified({ aboveHorizon: [{ target: 'moon' }], objects: [{ target: 'moon' }] }),
  })

  assert.equal(result.confidence, 'strong')
  assert.equal(result.candidates[0].event.id, fullMoon.id)
  assert.deepEqual(result.candidates[0].reasons, ['frame-match'])
})

test('heading orders candidates but never rejects them', async () => {
  const events = await fetchPastEventsForDay(FULL_MOON_DAY)
  const fullMoon = events.find((event) => event.title === 'Full Moon')
  const instant = new Date(new Date(fullMoon.startsAt).getTime() + 20 * 60_000)

  // What identifySky() actually returns for a camera facing 180 degrees away
  // from the Moon: the Moon is still above the horizon, but the heading/FOV
  // filter has dropped it from `objects`. Gate D reads aboveHorizon, so the
  // verdict must be unchanged.
  const result = rankPastEventCandidates(events, {
    ...PERTH,
    instant,
    headingDeg: 180,
    identified: identified({ aboveHorizon: [{ target: 'moon' }], objects: [] }),
  })

  assert.equal(result.confidence, 'strong', 'a wrong heading must not demote the match')
  assert.equal(result.candidates[0].event.id, fullMoon.id)
  // The tie-break needs a real azimuth, not `undefined` -- an earlier revision
  // read event.azimuthDeg, which SkyEvent does not have, so both sides were
  // undefined and the comparison silently always returned 0.
  assert.equal(typeof result.candidates[0].azimuthDeg, 'number')
  assert.ok(Number.isFinite(result.candidates[0].azimuthDeg))
})

test('heading reorders two otherwise-equal candidates', async () => {
  // Moon and Saturn are 176 degrees apart in azimuth and both above 8 degrees
  // from Perth at this instant, so heading is the only discriminator left once
  // confidence, kind and time all tie.
  const at = new Date('2026-08-21T14:00:00.000Z')
  const makeEvent = (target) => ({
    id: `heading-${target}`,
    kind: 'planet_event',
    target,
    title: target,
    description: '',
    startsAt: at.toISOString(),
    endsAt: at.toISOString(),
    updatedAt: at.toISOString(),
  })
  const events = [makeEvent('moon'), makeEvent('saturn')]
  const orderFor = (headingDeg) =>
    rankPastEventCandidates(events, { ...PERTH, instant: at, headingDeg }).candidates.map(
      (candidate) => candidate.event.target,
    )

  // Both land in `possible` (no frame to corroborate), so this is pure ordering.
  assert.deepEqual(orderFor(265), ['moon', 'saturn'], 'facing the Moon puts it first')
  assert.deepEqual(orderFor(81), ['saturn', 'moon'], 'facing Saturn puts it first')
})

test('a zero-duration event matches inside the +/-6h window and not outside it', async () => {
  // The regression ASV-34 documented: moon_phase, planet_event and conjunction
  // all ship starts_at === ends_at, so a naive containment check matches
  // nothing and a real conjunction falls through to the review queue.
  const events = await fetchPastEventsForDay('2026-08-12')
  const conjunction = events.find((event) => event.target === 'moon_jupiter')

  assert.ok(conjunction, 'expected the Moon-Jupiter conjunction in the generated day')
  assert.equal(conjunction.startsAt, conjunction.endsAt, 'this fixture must stay zero-duration')

  const peak = new Date(conjunction.startsAt).getTime()
  const foundAt = (hoursAfter) => {
    const result = rankPastEventCandidates(events, {
      ...PERTH,
      instant: new Date(peak + hoursAfter * 3_600_000),
    })
    return result.candidates.some((candidate) => candidate.event.id === conjunction.id)
  }

  assert.equal(foundAt(3), true, 'a photo 3h after peak is the same event')
  assert.equal(foundAt(6), true, 'the window is inclusive at its edge')
  assert.equal(foundAt(7), false, 'past the window')
  assert.equal(foundAt(9), false, 'well past the window')
})

test('a flagship kind reaches strong on time overlap alone, without frame corroboration', async () => {
  // A meteor photo is a streak against a star field. identifySky() names
  // naked-eye bodies and was never built to read one, so gate D must skip
  // rather than disagree -- otherwise every shower photo is demoted for a
  // frame the identifier cannot parse.
  const events = await fetchPastEventsForDay('2026-08-11')
  const shower = events.find((event) => event.kind === 'meteor_shower')

  assert.ok(shower, 'expected the Perseids in the generated day')

  const result = rankPastEventCandidates(events, {
    ...LONDON,
    instant: new Date(shower.startsAt),
    identified: null,
  })

  assert.equal(result.confidence, 'strong')
  const candidate = result.candidates.find((entry) => entry.event.id === shower.id)
  assert.equal(candidate.confidence, 'strong')
  assert.equal(candidate.frame, 'skipped')
  assert.deepEqual(candidate.reasons, ['flagship-kind'])
})

test('gate B drops an event that was not observable from where the photo was taken', async () => {
  // The 2026-08-12 total solar eclipse happened on the far side of Earth.
  // Perth could not see it, so it must not be offered as a candidate no matter
  // how well its time overlaps -- the photo cannot be of an eclipse you were
  // not under.
  //
  // Asked for as the 13th, not the 12th, for the timezone-band reason spelled
  // out at FULL_MOON_DAY: the eclipse peaks at 16:15:46.794Z, which is past the
  // end of the window a +14 process builds for the 12th. The event and its
  // timestamp are unchanged -- only the day prefix is.
  const events = await fetchPastEventsForDay('2026-08-13')
  const eclipse = events.find((event) => event.kind === 'eclipse')

  assert.ok(eclipse, 'expected the eclipse in the generated day')
  assert.equal(eclipse.startsAt, '2026-08-12T16:15:46.794Z')

  const result = rankPastEventCandidates(events, { ...PERTH, instant: new Date(eclipse.startsAt) })
  assert.equal(
    result.candidates.some((candidate) => candidate.event.id === eclipse.id),
    false,
    'an eclipse on the far side of Earth is not a candidate',
  )
})

test('gate A excludes an event pinned 800km from the observer', async () => {
  const makePass = (latitude, longitude) => ({
    id: `iss-${latitude}`,
    kind: 'iss_pass',
    target: 'iss',
    title: 'ISS pass',
    description: '',
    startsAt: '2026-07-01T12:00:00.000Z',
    endsAt: '2026-07-01T12:10:00.000Z',
    latitude,
    longitude,
    updatedAt: '2026-07-01T00:00:00.000Z',
  })
  const instant = new Date('2026-07-01T12:00:00.000Z')

  const far = rankPastEventCandidates([makePass(-25.0, 118.0)], { ...PERTH, instant })
  assert.equal(far.confidence, 'none', '800km away is not this observer\'s pass')

  const near = rankPastEventCandidates([makePass(-31.95, 115.86)], { ...PERTH, instant })
  assert.equal(near.confidence, 'possible')
})

test('a photo with no trustworthy time yields weak, never a rejection', async () => {
  // No EXIF timestamp, or the user overrode the day: the day is the user's
  // claim, so nothing may be auto-selected -- but the night's real events are
  // still offered as "also that night" chips.
  const events = await fetchPastEventsForDay('2026-08-11')
  const result = rankPastEventCandidates(events, { ...LONDON, instant: null })

  assert.equal(result.confidence, 'weak')
  assert.ok(result.candidates.length > 0, 'a real night still offers its events')
  for (const candidate of result.candidates) {
    assert.equal(candidate.confidence, 'weak')
    assert.deepEqual(candidate.reasons, ['no-trustworthy-time'])
    assert.equal(candidate.timeDeltaMs, null)
  }
})

test('an empty day ranks nothing', () => {
  const result = rankPastEventCandidates([], { lat: 0, lon: 0, instant: new Date() })
  assert.equal(result.confidence, 'none')
  assert.deepEqual(result.candidates, [])
})

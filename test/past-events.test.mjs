// Generating what was in the sky on a past date.
//
// The eclipse assertion below reuses the exact timestamp
// test/event-sources.test.mjs already pins for 2026-08-12, on purpose: the
// generators were *moved* out of scripts/ rather than copied, and this is the
// check that the move did not change what they compute. If a future
// refactor forks them, one of the two tests goes red.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  fetchPastEventsForDay,
  isGeneratedPastEventId,
  PAST_EVENT_ID_PREFIX,
} from '../src/lib/pastEvents.mjs'
import { canonicalKey } from '../src/lib/eventSources/canonical.mjs'

test('a past day matches the forward catalogue on the event it shares with it', async () => {
  const events = await fetchPastEventsForDay('2026-08-12')
  const eclipse = events.find((event) => event.kind === 'eclipse')

  assert.ok(eclipse, 'expected the 2026-08-12 total solar eclipse')
  // The same value test/event-sources.test.mjs asserts for the ingest path.
  assert.equal(eclipse.startsAt, '2026-08-12T16:15:46.794Z')
  assert.equal(eclipse.endsAt, '2026-08-12T19:15:46.794Z')
})

test('generation reaches a decade back', async () => {
  // astronomy-engine is VSOP87-based and evaluates a past date happily, so a
  // 2016 night costs the same as tonight. This is the whole reason history
  // needs no backfill job.
  const events = await fetchPastEventsForDay('2016-08-12')

  assert.ok(events.length > 0, 'a decade-old night still has an answer')
  for (const event of events) {
    assert.equal(event.startsAt.slice(0, 4), '2016')
  }
})

test('every event carries a stable, derivable id', async () => {
  // Regenerating the same night on another device has to produce the same id,
  // or the journal duplicates the row instead of recognising it.
  const first = await fetchPastEventsForDay('2026-08-12')
  const second = await fetchPastEventsForDay('2026-08-12')

  assert.deepEqual(
    first.map((event) => event.id),
    second.map((event) => event.id),
  )
  for (const event of first) {
    assert.equal(event.id, `${PAST_EVENT_ID_PREFIX}${event.kind}-${event.target}-2026-08-12`)
  }
})

test('every generated id is recognised by the predicate the wire depends on', async () => {
  // The regression guard for a bug that reached a live PocketBase before it
  // was caught: `sync.ts` sent this id as the `atlas_observations.event`
  // relation, and PocketBase validates a relation by looking the ids up, so
  // every photo-matched backdated check-in failed with "Failed to find all
  // relation records with the provided ids" (400) and never left the device.
  //
  // The fix is one predicate shared by the three call sites rather than three
  // hand-rolled `startsWith('past-')` checks. This asserts the invariant that
  // makes the predicate load-bearing: *anything this module generates* it must
  // recognise. A future change to id construction that forks from the prefix
  // fails here rather than in production.
  const events = await fetchPastEventsForDay('2026-08-12')
  assert.ok(events.length > 0, 'the guard is meaningless on an empty day')

  for (const event of events) {
    assert.equal(
      isGeneratedPastEventId(event.id),
      true,
      `${event.id} would be sent as a relation and rejected by PocketBase`,
    )
  }

  // A real `sky_events` row id is a 15-char PocketBase id and must survive as
  // a relation -- if the predicate were ever inverted or made total, the
  // ordinary tonight-path check-in would stop linking to its event.
  assert.equal(isGeneratedPastEventId('a1b2c3d4e5f6g7h'), false)
  assert.equal(isGeneratedPastEventId(undefined), false)
  assert.equal(isGeneratedPastEventId(null), false)
  assert.equal(isGeneratedPastEventId(''), false)
})

test('the day is deduped and sorted', async () => {
  const events = await fetchPastEventsForDay('2026-08-12')

  const keys = events.map(canonicalKey)
  assert.equal(new Set(keys).size, keys.length, 'no event is described twice')

  const starts = events.map((event) => event.startsAt)
  assert.deepEqual(starts, [...starts].sort(), 'the day reads in chronological order')
})

test('a day with no computable event resolves to an empty list, not a throw', async () => {
  // Not a claim that this date is empty -- a claim that the call is total.
  // Every generator is wrapped, so one that cannot answer for a date must not
  // take the other four down with it.
  const events = await fetchPastEventsForDay('1995-01-01')
  assert.ok(Array.isArray(events))
})

// What was actually in the sky on a given historical date.
//
// `sky_events` is a forward catalogue -- ingest only ever writes the next
// ~14 days and pullSkyEvents actively deletes cached rows the server doesn't
// return -- so it can never answer a question about 2019. Rather than
// backfilling history into PocketBase (a large, one-off, maintenance-heavy
// job), past days are *computed on demand* from the same deterministic
// generators the ingest seed uses. astronomy-engine is VSOP87-based and
// perfectly happy to evaluate a past date, so a decade-old night costs the
// same as tonight.
//
// The five generators live in ./eventSources/ and are shared verbatim with
// scripts/seed-curated-window.mjs. Only the deterministic ones are here:
// aurora, asteroid approaches, ISS/satellite passes, comets and fireballs all
// need live external data that cannot be reconstructed after the fact.
import { fetchEvents as fetchMoonPhaseEvents } from './eventSources/moon-phase.mjs'
import { fetchEvents as fetchMeteorShowerEvents } from './eventSources/meteor-showers.mjs'
import { fetchEvents as fetchEclipseEvents } from './eventSources/eclipses.mjs'
import { fetchEvents as fetchPlanetEvents } from './eventSources/planets.mjs'
import { fetchEvents as fetchConjunctionEvents } from './eventSources/conjunctions.mjs'
import { canonicalKey } from './eventSources/canonical.mjs'

const GENERATORS = [
  fetchMoonPhaseEvents,
  fetchMeteorShowerEvents,
  fetchEclipseEvents,
  fetchPlanetEvents,
  fetchConjunctionEvents,
]

// How far either side of the requested civil day the generators are asked to
// look. A day is not enough on its own: a zero-duration event (a moon-phase
// peak, a conjunction's closest approach) is matched by the ranker inside a
// +/-6h window (see POINT_EVENT_WINDOW_HOURS in eventVisibility.mjs), so a
// peak at 03:00 the next morning is a legitimate match for a 23:00 photo --
// but only if it is in the candidate set to begin with. Generating a padded
// window and letting the ranker's time gate do the narrowing keeps the two
// in agreement instead of silently truncating.
//
// The pad is deliberately *generous*, and the reason is timezones. dayKey is
// the civil date in the zone where the photo was taken, but localMidnight()
// below can only produce it in the zone the process is running in; the two
// differ by up to 12h for a traveller, and by the whole spread of offsets for
// anyone whose photo location and current location disagree. Sizing the
// window for the exact civil day would then silently drop real events --
// which is not hypothetical: a 36h window anchored at Perth local midnight
// missed the 2026-08-12 total solar eclipse (16:15:46.794Z) by 15 minutes.
// The gates do the precise filtering anyway, so extra candidates cost a
// little work and lose nothing.
//
// Still one day, day-at-a-time: this is a 54-hour window, not a range. The
// generators all bound their searches (planets.mjs caps its opposition loop
// at 5 iterations, the eclipse and moon loops advance one event at a time),
// so a wider window would not be wrong, just slower for no benefit.
const LEAD_IN_HOURS = 24
// The civil day itself, plus the same +6h the ranker's time gate allows.
const TAIL_OUT_HOURS = 30
const WINDOW_DAYS = (LEAD_IN_HOURS + TAIL_OUT_HOURS) / 24

function localMidnight(dayKey) {
  // Local, not UTC: dayKey is the civil date the user was living in.
  return new Date(`${dayKey}T00:00:00`)
}

/**
 * The prefix every generated past-event id carries. Exported because the id
 * shape is a fact three call sites need, not an implementation detail of this
 * module: `sync.ts` must not send one as a relation, and `checkInReview.ts`
 * parses the day back out of one.
 */
export const PAST_EVENT_ID_PREFIX = 'past-'

/**
 * Whether an id names a *generated* past event rather than a `sky_events` row.
 *
 * Load-bearing at the wire, not merely descriptive. `atlas_observations.event`
 * is a relation, and PocketBase validates it by looking the ids up: sending a
 * generated id fails the whole record with "Failed to find all relation
 * records with the provided ids" (400), so a photo-matched backdated check-in
 * could never sync at all. The field must be omitted, not nulled.
 *
 * The queue collection already models this correctly -- its `event_id` is
 * plain text beside the `event_snapshot` json, precisely because the candidate
 * is computed and never persisted.
 */
export function isGeneratedPastEventId(id) {
  return typeof id === 'string' && id.startsWith(PAST_EVENT_ID_PREFIX)
}

/**
 * Mirror of sync.ts's skyEventFromRecord for events that were generated
 * rather than read from PocketBase.
 *
 * Deliberately not imported from sync.ts: that module pulls in the
 * PocketBase SDK, analytics and atlasMedia, none of which a generated event
 * touches, and the ranker has to stay callable from a plain `node --test`
 * process. The two mappers differ in exactly one place -- parsePbDate exists
 * only to repair PocketBase's space-separated datetime format, and the
 * generators already emit ISO strings -- so the shapes stay in step by
 * convention rather than by import. If SkyEvent gains a field, both need it.
 */
function skyEventFromGenerated(event, dayKey) {
  return {
    // Stable and derivable, so the same past night regenerated on another
    // device produces the same id and the journal doesn't duplicate rows.
    id: `${PAST_EVENT_ID_PREFIX}${event.kind}-${event.target}-${dayKey}`,
    kind: event.kind,
    target: event.target,
    title: event.title,
    description: event.description,
    content: event.content,
    imageUrl: event.image_url,
    imageCredit: event.image_credit,
    startsAt: new Date(event.starts_at).toISOString(),
    endsAt: new Date(event.ends_at ?? event.starts_at).toISOString(),
    // Generators emit no coordinates -- these are sky-wide events, so
    // isLocalEvent() treats them as visible everywhere, which is correct.
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Every deterministically-computable event overlapping the civil day
 * `dayKey` ('YYYY-MM-DD'). Deduped with the same canonicalKey the ingest
 * seed uses, so a shower that two generators both describe appears once.
 */
export async function fetchPastEventsForDay(dayKey) {
  const dayStart = localMidnight(dayKey)
  const now = new Date(dayStart.getTime() - LEAD_IN_HOURS * 3_600_000)

  const results = await Promise.all(
    GENERATORS.map(async (fetchEvents) => {
      try {
        return await fetchEvents({ now, windowDays: WINDOW_DAYS })
      } catch {
        // A generator that cannot answer for this date (e.g. an eclipse
        // search past the ephemeris table) must not take the whole day with
        // it -- the remaining four still describe a real sky.
        return []
      }
    }),
  )

  const byKey = new Map()
  for (const event of results.flat()) {
    const key = canonicalKey(event)
    if (!byKey.has(key)) byKey.set(key, skyEventFromGenerated(event, dayKey))
  }

  return [...byKey.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

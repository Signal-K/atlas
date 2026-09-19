// The canonical-identity rule for an astronomy event: what makes two events
// "the same event" for dedupe purposes.
//
// This lives here rather than in seed-curated-window.mjs because two callers
// now need to agree on it -- the ingest seed script (which dedupes the whole
// 14-day catalogue before upserting) and the past-check-in matcher (which
// merges the output of several generators for one historical day). A second
// copy would drift invisibly: the seed would keep producing correct forward
// windows while the matcher silently double-counted or dropped candidates.
//
// Events arrive in two shapes. The generators and the seed script speak
// snake_case (`starts_at`), matching the `sky_events` collection; the client's
// SkyEvent is camelCase (`startsAt`). Both spellings are accepted so one
// definition serves both, rather than forcing a conversion at either edge.

export function dateKeyOf(value) {
  return new Date(value).toISOString().slice(0, 10)
}

function startsAtOf(event) {
  return event.starts_at ?? event.startsAt
}

function endsAtOf(event) {
  return event.ends_at ?? event.endsAt ?? startsAtOf(event)
}

export function canonicalKey(event) {
  return `${event.kind}:${event.target}:${dateKeyOf(startsAtOf(event))}`
}

export function isInCuratedWindow(event, { now = new Date(), windowDays = 14 } = {}) {
  const start = now.getTime()
  const end = start + windowDays * 86_400_000
  const startsAt = new Date(startsAtOf(event)).getTime()
  const endsAt = new Date(endsAtOf(event)).getTime()
  // A peak event can start the previous evening and still be happening on
  // the calendar day people expect to find it. Keep all events that overlap
  // the window, not only ones whose start timestamp falls inside it.
  return startsAt <= end && endsAt >= start
}

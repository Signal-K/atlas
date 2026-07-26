---
id: story-new-keyless-event-sources
type: story
epic: epic-event-data-expansion
title: Add asteroid close-approach and fireball event sources
status: done
priority: medium
---

# Add asteroid close-approach and fireball event sources

**As an** Atlas user
**I want** more real astronomical activity in the feed
**So that** there's enough to browse, log, and test against, without
resorting to fake/placeholder data.

Both sources are free and keyless (no registration, no rate-limit
approval needed), so they run in production immediately.

## Acceptance criteria

- [x] New source: near-Earth asteroid close approaches.
- [x] New source: recent bright fireball (bolide) detections.
- [x] Both registered in the scheduled ingest (`scripts/ingest.mjs`).
- [x] Both wired into category grouping, labels, icons, and
      tonight-target ranking defaults so they render correctly everywhere
      existing event kinds do, not just in the raw feed.

## Implementation

**`scripts/sources/asteroid-approaches.mjs`** — NASA/JPL Small-Body
Database Close-Approach Data API (`ssd-api.jpl.nasa.gov/cad.api`).
Filtered to approaches within 0.05 AU (~19.5 lunar distances), capped at
20 events, sorted closest-first. New kind `asteroid_approach` — global
(no lat/lon), same treatment as moon phases, since a close approach isn't
tied to a viewer's location and most need a tracked telescope exposure to
actually image (not naked-eye).

**`scripts/sources/fireballs.mjs`** — NASA/JPL Fireball Data API
(`ssd-api.jpl.nasa.gov/fireball.api`). Unlike every other source here,
this is retrospective (fireballs that already happened, reported with a
lag of days to weeks), so its `windowDays` parameter means "how far back
to look," not "how far forward." New kind `fireball` — deliberately left
without per-event lat/lon (folded into the description text instead)
since filtering by proximity would hide nearly all of them; its
past-dated `starts_at` means it surfaces via the existing Archive/Journal
past-events view (`getPastEvents`/`ArchiveView`) rather than the
forward-looking Events/Plan feed, which is correct — it's a record, not
something to go outside for.

Both guarded against a JPL API quirk where numeric fields are `null`
(not omitted) for unmeasured values — `Number(null)` is `0`, which would
otherwise silently mislabel "unknown" as "zero."

Category/label/icon wiring: `src/lib/eventCategories.ts` (fireball folded
into "Meteors & fireballs"; new "Asteroids" category with a new
`asteroid` glyph in `src/components/mobile/MobileIcon.tsx`),
`src/widgets/EventRow.tsx` (`KIND_LABELS`), `src/views/mobile/HubView.tsx`
(`KIND_KICKER`), `src/lib/tonightTargets.ts` (`KIND_META` — both marked
`nakedEyeVisible: false`, low priority), `src/views/EventCategoryPlanView.tsx`
(desktop category buckets).

Verified against the live endpoints (not mocked): 8 asteroid approaches
and 3 fireballs returned for a real 2-week/60-day window at the time of
writing, both with correct field parsing.

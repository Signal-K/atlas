---
id: story-location-event-coverage-fix
type: story
epic: epic-event-data-expansion
title: Fix zero location-bound events for users far from the curated city list
status: done
priority: high
---

# Fix zero location-bound events for users far from the curated city list

**As an** Atlas user whose location isn't near one of the curated cities
**I want** ISS/satellite pass events to still reach me
**So that** I'm not silently getting zero location-bound events every
single day.

## Root cause

Every location-bound event (ISS passes, Tiangong/Hubble/Starlink-train
passes) is precomputed at ingest time against a fixed curated `CITIES`
list (`scripts/sources/cities.mjs` / `src/lib/cities.ts`), not the
viewer's actual coordinates. The client then keeps only events within
`LOCAL_EVENT_RADIUS_KM` (120km) of the viewer (`isLocalEvent`,
`src/lib/eventFilters.ts`). For a real user in the Baltic region, the
nearest curated city (Helsinki) was still well outside 120km — meaning
every satellite-pass event ever generated was filtered out for them, not
just fewer than ideal.

## Acceptance criteria

- [x] Match radius widened enough to cover meaningfully more real
      locations without becoming geographically meaningless.
- [x] At least one curated city added for the specific gap reported.

## Implementation

- `src/lib/eventFilters.ts`: `LOCAL_EVENT_RADIUS_KM` 120 → 200km.
- `src/lib/cities.ts` and `scripts/sources/cities.mjs` (kept in sync per
  their own header comments): added Tallinn, Riga, Vilnius.

## Known gap

This is still a curated-list approximation, not per-viewer computation —
a location far from *any* curated city (200km+) will still see nothing
location-bound. A real fix would compute passes against the viewer's
actual coordinates client-side or at request time rather than a fixed
city list; out of scope for this pass.

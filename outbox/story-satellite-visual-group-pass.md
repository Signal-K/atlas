---
id: story-satellite-visual-group-pass
type: story
epic: epic-event-data-expansion
title: Widen satellite pass coverage (Hubble, Celestrak visual group, longer windows)
status: done
priority: low
---

# Widen satellite pass coverage

**As an** Atlas user
**I want** more variety in naked-eye satellite passes, not just the ISS
**So that** satellite events don't feel like the same one or two objects
on repeat.

## Acceptance criteria

- [x] A second bright, well-known bare satellite alongside Tiangong.
- [x] A new source covering more of Celestrak's own curated "brightest
      satellites" list, kept small enough to stay lightweight.
- [x] Existing satellite windows widened where the underlying TLE
      reliability comment already allowed more headroom.

## Implementation

- `scripts/sources/satellite-flares.mjs`: generalized the
  Tiangong-specific pass function into `bareSatelliteEvents()` over a
  `BARE_SATELLITES` list, and added Hubble (CATNR 20580) alongside
  Tiangong. `TRAIN_WINDOW_DAYS` 2 → 5 days.
- `scripts/sources/iss-passes.mjs`: default `windowDays` 5 → 7 (still
  within the file's own "1-2 weeks" TLE-reliability comment).
- `scripts/sources/satellite-visual-group.mjs` (new): passes for
  Celestrak's "visual" group (their own curated ~100 brightest
  in-orbit objects — mostly old rocket bodies that tumble and flare
  unpredictably, plus a few well-known satellites), excluding
  ISS/Tiangong/Hubble to avoid duplicate cards for the same object.

  Deliberately capped, not a straight "add all 100": a first pass at 20
  objects across the full city list produced ~2,700 events in a 3-day
  window alone — enough to drown out every other event kind in the feed.
  Cut to 8 objects, a shorter 3-day window, and a higher 35° minimum
  elevation (vs. the shared 20° default) since these are dimmer,
  less-famous objects than the ISS — landed at ~580 events over 3 days
  worldwide, a meaningful volume boost without becoming the whole feed.

All changes verified against the live Celestrak endpoints, including
confirming the existing per-plugin failure isolation in `ingest.mjs`
degrades gracefully when Celestrak's throttle-notice response (a 503
after repeat requests in a short window) hits one of these sources.

---
id: story-premium-example-photos
type: story
epic: epic-premium-tiering
title: "Premium: example photos from nearby sky-watchers"
status: in-progress
priority: medium
source: "Liam, in chat: 'example photos - that way, I can get an idea if I want to go outside', then clarified: 'find sky photos from cities nearby, and match them to event types, including nights with good conditions but nothing going on beyond the norm'. Premium-only."
---

# Premium: example photos from nearby sky-watchers

**As a** Sky Pass user looking at tonight's highlights or the global feed
**I want** to see a real photo someone nearby actually captured of that
kind of event (or of an ordinary good-conditions night, when nothing
special is happening)
**So that** I can judge whether it's worth going outside before I
actually do.

## Why community photos, not stock/AI images

Atlas already has real, geotaggable user photography: `atlas_discoveries`
(the Feed/Community "I saw this" gallery, `src/lib/discoveries.ts`) and
`ObservationLogEntry` (Scrapbook log entries, `src/lib/db.ts`), both of
which already carry a `target`/`imageUrl`. Matching from Atlas's own
community, filtered to nearby posters, is more honest than stock
photography (conditions/light pollution actually resemble what the user
will see) and avoids sourcing/licensing a photo library from scratch.

## Acceptance criteria

- [ ] `atlas_discoveries` gains optional `latitude`/`longitude` fields,
      captured best-effort at post time (from the poster's current
      location), via a new PocketBase migration.
- [ ] A matching function picks, for a given event and viewer location:
      1. discoveries whose `target` matches the event's target/title,
         preferring closer posters, within a generous radius (sky photos
         of the same target look similar across a wide region, so this
         doesn't need to be tight);
      2. failing that, for "nothing special" nights (`local_night_sky`/
         `night_sky_guide` filler kinds), any nearby discovery at all, as
         a "here's what a good ordinary night looks like from near you"
         example rather than requiring an exact target match;
      3. otherwise nothing is shown — no fabricated fallback image.
- [ ] Shown as a small photo strip on `HighlightCards` and the global
      feed, Sky Pass-gated, captioned with the poster's name and
      "near you" / distance, never presented as if Atlas took the photo.

## Implementation

New `src/lib/examplePhotos.ts` (`matchExamplePhotos(discoveries, event,
city)`), using the existing `haversineKm` (`cities.ts`) for distance.
`discoveries.ts`'s `Discovery`/`createDiscovery` extended with optional
`latitude`/`longitude`; `FeedView`'s post form now takes the current
location and includes it on submit when available. New migration
`pocketbase/migrations/<ts>_atlas_discoveries_location.js` adds the two
nullable number fields to the existing `atlas_discoveries` collection.

---
id: story-sky-map-search
type: story
epic: epic-sky-map-standalone-page
title: Text search on the sky map (no API key, works offline)
status: done
priority: medium
---

# Text search on the sky map

**As an** Atlas user looking at the sky map
**I want** to type roughly what I'm looking for
**So that** I don't have to scroll the visible-objects rail or physically
point my phone to find something specific.

## Acceptance criteria

- [x] A search box on the sky map matches free text against what's
      actually visible right now and selects the match, same as tapping
      it in the visible-objects rail would.
- [x] Handles plain object names ("jupiter"), constellations ("what's in
      orion"), categories ("brightest star", "any planets"), and rough
      compass directions ("what's in the north/northeast/etc").
- [x] Says so plainly when nothing matches, rather than silently doing
      nothing.
- [x] No API key, no network call, works offline -- same "lightweight,
      no ongoing cost" tier as the smart-caption-suggestion work in
      epic-camera-and-photo-guidance, not the vision/LLM tier.

## Implementation

`src/lib/skyMapSearch.ts`: `findSkyMapObjectFromQuery(query, objects)`,
a pure function run against whatever `SkyMapOverlay` already computed as
currently visible (`allVisibleObjects`) -- no new data source. Strips
filler words ("where's", "show me", "the"...), then tries, in order:
exact/partial name match (longest match wins), constellation match,
category-word match (star/planet/moon/deep-sky), then a compass-direction
word match (longest direction word checked first, so "northeast" doesn't
get misread as "north").

`src/components/SkyMapOverlay.tsx`: new search form above the map canvas,
wired to the existing `selectedObjectId` selection state (search just
finds an object and selects it the same way tapping the rail does --
no new detail-rendering path to maintain). Shows a plain "nothing
matching that is visible right now" message on no match.

## Known gap (future work, not started)

This is deliberately the free/no-cost tier -- it won't parse something
like "that reddish one low in the east" (needs real language
understanding of relative/vague descriptions, not just keyword
matching). A genuine LLM-backed version of this search would follow the
exact same "gated behind an API key, not enabled in production" pattern
as `story-ai-photo-captions` and `story-space-weather-donki` if wanted
later.

---
id: epic-sky-map-standalone-page
type: epic
title: Sky map as its own page, with search
status: in-progress
priority: medium
source: "Liam, in chat: 'The star map needs to be able to open in its own page, and have nlp input'"
---

# Sky map as its own page, with search

The live sky map (`SkyMapOverlay`, the "point my phone" full-screen view)
only ever existed as local component state inside `HubView` -- not a
URL, not bookmarkable, not shareable, no back-button support. Also
requested: a way to type what you're looking for instead of only
scrolling the "visible objects" rail or physically pointing the phone.

## Child stories

- story-sky-map-own-page
- story-sky-map-search

## Status

Both done for mobile, where the feature already existed. Desktop has no
equivalent full sky map surface at all yet (`TonightView` only has the
smaller inline `SkyDirectionCompass`) -- out of scope for this pass, not
because it doesn't need one, but rebuilding this UI for a second form
factor without any existing precedent to adapt is a bigger job than
routing/search on top of what already exists.

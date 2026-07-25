---
id: story-feed-simplified-sky-map
type: story
epic: epic-feed-redesign
title: Simplify default sky map to direction + altitude
status: backlog
priority: medium
---

# Simplify default sky map to direction + altitude

**As an** Atlas user glancing at a target's sky map
**I want** the default view to only show direction and altitude
**So that** it stays fast to read outside, with cloud coverage as an
optional deeper layer instead of always-on.

## Acceptance criteria

- [ ] Default sky map/compass view for a target shows only compass
      direction + altitude above horizon (matches `SkyDirectionCompass`'s
      current minimal style).
- [ ] Tapping/expanding the map reveals a cloud-coverage overlay layer.
- [ ] No regression to the existing full planetarium view (`SkyMapCanvas`)
      used elsewhere — this only affects the quick per-target preview.

## Notes for implementation

`src/components/SkyDirectionCompass.tsx` already renders the minimal
direction+altitude view used in `TonightView`'s "Where to look" section —
this is close to the target state already. `src/components/SkyMapCanvas.tsx`
and `src/components/SkyMapOverlay.tsx` carry the fuller planetarium/cloud
overlay logic; the work here is adding a tap-to-expand affordance that
layers `SkyMapOverlay`'s cloud data on top of the compass view rather than
showing it by default.

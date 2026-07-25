---
id: story-feed-simplified-sky-map
type: story
epic: epic-feed-redesign
title: Simplify default sky map to direction + altitude
status: done
priority: medium
---

# Simplify default sky map to direction + altitude

**As an** Atlas user glancing at a target's sky map
**I want** the default view to only show direction and altitude
**So that** it stays fast to read outside, with cloud coverage as an
optional deeper layer instead of always-on.

## Acceptance criteria

- [x] Default sky map/compass view for a target shows only compass
      direction + altitude above horizon (`SkyDirectionCompass`, unchanged).
- [x] Tapping "Show cloud coverage" reveals a cloud-coverage line for that
      target's plan section.
- [x] No regression to the existing full planetarium view (`SkyMapCanvas`)
      used elsewhere — this only affects the quick per-target preview in
      Tonight's "Where to look" section.

## Implementation

`src/views/TonightView.tsx`: added a `showCloudOverlay` toggle button
under `SkyDirectionCompass` in the target plan section, reset whenever a
different target is expanded. Reveals `plan.todayAdvisory`'s cloud/rain
summary (already computed, just not shown here before) via the existing
`formatWeatherSummary` helper.

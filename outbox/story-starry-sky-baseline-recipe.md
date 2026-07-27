---
id: story-starry-sky-baseline-recipe
type: story
epic: epic-camera-and-photo-guidance
title: Camera guidance for an ordinary night with nothing special happening
status: done
priority: medium
source: "Liam, in chat: 'show users the state of play for the stars in the sky that night, even if there's nothing going on super special, and give them presets and instructions... at minimum'"
---

# Camera guidance for an ordinary night with nothing special happening

**As an** Atlas user on a night with no headline event
**I want** the "visible tonight" guide to still come with camera
instructions, not just a description of what's up
**So that** every night gives me something actionable, not just
something to read.

## Root cause

`buildDailySkyGuideEvents` (shipped earlier this week, see
`story-feed-day-grouping-improvements`) already fills every day with a
"Visible tonight" card describing planets and bright stars. But
`recipeKeyForEventKind()` had no entry for its `night_sky_guide` /
`local_night_sky` kinds, so `EventDetailPanel` never showed a camera
setup section for these cards at all -- the one event guaranteed to
exist every single night was the one that never offered a preset.

## Acceptance criteria

- [x] New `starry_sky` recipe: honest about what a phone can actually
      capture on an ordinary night (a handful of bright stars/planets,
      ambient glow near a city) rather than reusing the existing
      `milky_way` recipe, which promises a dark-sky Milky Way core most
      nights and most locations won't deliver.
- [x] `night_sky_guide` and `local_night_sky` event kinds now resolve to
      it via `recipeKeyForEventKind`.

## Implementation

`src/lib/cameraRecipes.ts`: new `starry_sky` entry in `CAMERA_RECIPES`
(mode/lens/tripod/exposure/focus per device family, same shape as every
other recipe), added to the `RecipeKey` union, and mapped from both
filler-guide kinds in `RECIPE_KEY_FOR_EVENT_KIND`.

---
id: story-condition-aware-camera-recipes
type: story
epic: epic-camera-and-photo-guidance
title: Camera recipes react to tonight's actual conditions
status: done
priority: low
---

# Camera recipes react to tonight's actual conditions

**As a** Sky Pass user opening a camera recipe
**I want** the recipe to acknowledge tonight's actual sky, not just give
generic evergreen advice
**So that** I know whether it's even worth setting up, or what to adjust
given tonight specifically.

## Acceptance criteria

- [x] The camera recipe panel (already Sky Pass-gated, see
      story-event-detail-subpage/PaywallGate usage in `CameraRecipe.tsx`)
      shows a one-line "Tonight:" tip above the static recipe when live
      condition data is available.
- [x] Flags high cloud cover, moon washout for moon-sensitive targets
      (Milky Way, meteor showers), and low altitude (more atmospheric
      blur) -- with a positive note ("clear sky, good conditions") when
      none of those apply.
- [x] No new data source -- built entirely from cloud/moon/altitude
      values the calling view already computed (`TonightPlan`, viewing
      advisory) before the recipe panel renders.

## Implementation

`src/lib/cameraRecipes.ts`: `describeLiveConditions(recipeKey,
conditions)` -- pure function, `LiveRecipeConditions` input type.
`src/components/CameraRecipe.tsx`: new optional `liveConditions` prop,
rendered as a highlighted tip line inside the existing (Sky Pass-gated)
panel. Wired at the `TonightView` "Camera recipe" toggle, the one call
site with a specific target's live direction/altitude on hand; the
twilight-recipe and event-detail-panel call sites were left without it
since a browsed future event doesn't have "tonight's" conditions in the
same way a currently-visible target does.

---
id: story-nearby-better-conditions-alert
type: story
epic: epic-premium-tiering
title: "Paid alert: substantially better conditions nearby"
status: done
priority: medium
---

# Paid alert: substantially better conditions nearby

**As a** paying Atlas user
**I want** a nudge when somewhere nearby has meaningfully darker skies
**So that** I know a short trip could substantially improve tonight's
viewing.

## Acceptance criteria

- [x] Paid-only alert compares the user's current location's light
      pollution (Bortle class) against nearby curated dark-sky sites.
- [x] Only fires when the delta is substantial (>= 2 Bortle classes) and
      the site is reasonably reachable (<= 150 km).
- [x] Alert links into the dark-sky trip planner.

## Implementation

`WeekConditionsStrip` uses `estimateLightPollution` and
`rankLowerLightPollutionSites` from `src/lib/darkSky.ts` (pre-existing dark
-sky trip data) to compute and render the `.feed-nearby-alert` banner.

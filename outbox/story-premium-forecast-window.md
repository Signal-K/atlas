---
id: story-premium-forecast-window
type: story
epic: epic-premium-tiering
title: "Premium: per-day rating header + extended forecast window"
status: done
priority: medium
---

# Premium: per-day rating header + extended forecast window

**As a** paying Atlas user
**I want** each unlocked day in the week strip to show a rating for how
good that day is, based on conditions and what I can see, on top of a
longer forecast window than free accounts get
**So that** Sky Pass clearly earns its price on planning ahead.

(Clarified by Liam: "Premium users get an extra header for [each] day,
showing an estimate of how good that day is, based on conditions and what
they can see.")

## Acceptance criteria

- [x] Paid accounts see conditions for more days than free accounts in the
      week strip (gated by `forecastLookaheadDays(entitled)`).
- [x] Each unlocked day (entitled users only) shows a rating header
      (Great/Good/Maybe/Poor/Skip) computed from that day's cloud cover,
      rain chance, and moonlight.
- [x] Each unlocked day shows up to 2 of that day's actual events as a
      "what you can see" line under the rating.

## Implementation

`src/lib/weekConditions.ts` adds `rateDayCondition` (reuses the existing
pure `scoreTonight` scorer from `tonightScore.ts`) and `hasBrightTarget`.
`WeekConditionsStrip` fetches the week's events via
`getEventsInRange`/`pullSkyEvents` (same pattern as `CalendarView`), groups
them by local date with `localDateKey`, and renders the rating +
`diversifyEvents`-picked highlights per day for entitled users only.

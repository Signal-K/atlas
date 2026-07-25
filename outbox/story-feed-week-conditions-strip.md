---
id: story-feed-week-conditions-strip
type: story
epic: epic-feed-redesign
title: Week conditions strip with premium cutoff
status: done
priority: high
---

# Week conditions strip with premium cutoff

**As an** Atlas user
**I want** a horizontal week-ahead strip on the feed showing light
pollution/moonlight, optimal viewing time, and cloud coverage per day
**So that** I can plan which night this week is worth going outside for,
and understand what upgrading unlocks.

## Acceptance criteria

- [x] Renders one card per day for a week, each with three metrics: cloud
      coverage %, a moonlight/light-pollution label, and the optimal
      (astronomical-dusk) viewing time.
- [x] Free accounts see `FREE_FORECAST_DAYS` (3) days unlocked; remaining
      days render as locked cards with a "Sky Pass" label.
- [x] Paid accounts see the full strip.
- [x] A note below the strip explains the free/paid split and links to
      upgrade.

## Implementation

`src/lib/weekConditions.ts` (`getWeekConditions`) combines the existing
`fetchViewingForecast` (weather.ts), `moonIlluminationPctAt` (moonPhase.ts),
and a newly-exported `getDarknessWindow` (tonightTargets.ts) into one
per-day record. Rendered by `WeekConditionsStrip`, gated by
`forecastLookaheadDays()` from `entitlementLimits.ts`.

---
id: story-premium-forecast-window
type: story
epic: epic-premium-tiering
title: "Premium: extended forecast window + per-day tips"
status: in-progress
priority: medium
---

# Premium: extended forecast window + per-day tips

**As a** paying Atlas user
**I want** a much longer forecast window than free accounts, with a good
sense of what conditions and tips look like for each day
**So that** Sky Pass clearly earns its price on planning ahead.

## Acceptance criteria

- [x] Paid accounts see conditions for more days than free accounts in the
      week strip (gated by `forecastLookaheadDays(entitled)`).
- [ ] Per-day "tips" (what's worth planning for that day, not just raw
      numbers) beyond the three raw metrics currently shown.

## Status / next step

The week strip (`WeekConditionsStrip`) already unlocks more days for
entitled users and shows the three condition metrics. What's still open
is the "good idea what this can be, based on conditions" tip line per
day — e.g. surfacing the best target for that specific day rather than
just cloud/moon/optimal-time numbers. That needs a per-day target ranking
(similar to `getTonightPlan`, but for a future date) which doesn't exist
yet in `src/lib/tonightTargets.ts`.

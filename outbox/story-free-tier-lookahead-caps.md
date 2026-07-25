---
id: story-free-tier-lookahead-caps
type: story
epic: epic-premium-tiering
title: "Free tier: 10-day events / 3-day forecast caps"
status: done
priority: high
---

# Free tier: 10-day events / 3-day forecast caps

**As the** product
**We want** free accounts capped at 10 days of future event lookahead and
3 days of light-pollution/conditions forecast
**So that** there's a clear, generous-but-limited free tier that makes
Sky Pass worth buying.

## Acceptance criteria

- [x] Free accounts see up to 10 days of future sky events.
- [x] Free accounts see up to 3 days of conditions forecast.
- [x] Paid accounts see a substantially larger window for both.

## Status

Already implemented pre-session in `src/lib/entitlementLimits.ts`
(`FREE_EVENT_LOOKAHEAD_DAYS = 10`, `FREE_FORECAST_DAYS = 3`,
`PAID_EVENT_LOOKAHEAD_DAYS`, `PAID_FORECAST_DAYS`), consumed by the
Today/Events/Plan surfaces and the weather widget. Logged here for
traceability against the notes, no code change needed.

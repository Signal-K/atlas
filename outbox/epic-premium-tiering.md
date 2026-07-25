---
id: epic-premium-tiering
type: epic
title: Premium tiering & smart alerts
status: in-progress
priority: high
source: "Notebook page 1, 'Some rules/ideas' items 2-6"
---

# Premium tiering & smart alerts

Rules for what free vs. paid (Sky Pass) accounts get, and the smart
nudges that should make the paid tier feel worth it:

1. Free accounts get 10 days of future event forecasts and 3 days of
   light-pollution/conditions forecast.
2. Paid accounts get a substantially longer forecast window, with a good
   sense of what conditions and tips look like for each day.
3. Paid accounts get an alert when there are substantially better
   conditions available somewhere nearby, for a given day.
4. Paid accounts can change their preview location from the feed itself.

## Child stories

- story-free-tier-lookahead-caps
- story-premium-forecast-window
- story-nearby-better-conditions-alert
- story-paid-location-override

## Status

Free-tier caps already existed (`src/lib/entitlementLimits.ts`,
`FREE_EVENT_LOOKAHEAD_DAYS`/`FREE_FORECAST_DAYS`). The premium forecast
window and nearby-better-conditions alert now surface in the new week
strip (`WeekConditionsStrip`), reusing `rankLowerLightPollutionSites` from
`src/lib/darkSky.ts`. Inline location override from the feed (rather than
via the existing Settings link) is still backlog.

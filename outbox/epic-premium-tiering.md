---
id: epic-premium-tiering
type: epic
title: Premium tiering & smart alerts
status: in-progress
priority: high
source: "Notebook page 1, 'Some rules/ideas' items 2-6; later chat: 'a section on desktop that shows a global feed... all real events' plus 'example photos... so I can get an idea if I want to go outside', both premium-only"
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
- story-premium-global-feed
- story-premium-example-photos

## Status

Free-tier caps already existed (`src/lib/entitlementLimits.ts`,
`FREE_EVENT_LOOKAHEAD_DAYS`/`FREE_FORECAST_DAYS`). The premium forecast
window (with a per-day rating header + "what you can see" line),
nearby-better-conditions alert, and inline location change all now ship
in `WeekConditionsStrip`. First four child stories done.

Two more added from a later chat request: a location-agnostic desktop
"global feed" of genuinely global real events, and example reference
photos (sourced from Atlas's own nearby community discoveries, not stock
imagery) so a premium user can gauge whether tonight is worth going
outside for before checking the sky themselves.

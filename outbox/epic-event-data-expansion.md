---
id: epic-event-data-expansion
type: epic
title: Event data coverage & volume
status: in-progress
priority: medium
source: "Liam, in chat: 'not enough data to log or test reliably', then 'look into APIs you can add'"
---

# Event data coverage & volume

Liam's report: the events feed doesn't have enough happening this week to
reliably log or test against. Investigated in two passes:

1. A real coverage bug, not just "need more sources" — the curated
   `CITIES` list used for every location-bound event (ISS/satellite
   passes) had nothing within the old 120km match radius for a real
   fraction of users, so those users saw *zero* location-bound events,
   not just few.
2. On top of that, a request to research and add genuinely new
   astronomical-activity data sources so there's more to work with, with
   two constraints: anything needing a registered API key/auth stays
   disabled in production until a key is actually configured, and
   whatever's added should stay lightweight (bounded compute, bounded
   event volume) rather than flooding the feed with low-value noise.

## Child stories

- story-location-event-coverage-fix
- story-new-keyless-event-sources
- story-satellite-visual-group-pass
- story-space-weather-donki

## Status

First three stories done. `story-space-weather-donki` is implemented but
intentionally not enabled anywhere — see that story for why.

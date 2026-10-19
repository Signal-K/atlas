---
id: story-object-search-desktop-polish
type: story
epic: epic-events-overhaul
title: Search celestial objects and show their next local events
status: done
priority: high
source: "Direct user request, 2026-09-24"
external_tracker: Linear ASV-66
---

# Search celestial objects and show their next local events

**As an** Atlas observer
**I want** to search for a celestial object
**So that** I can see its next relevant observing events for my current location.

## Acceptance criteria

- [x] Search matches object names, catalogue identifiers, event titles and event targets.
- [x] Each matching object shows its next locally visible events in chronological order.
- [x] Local observing targets are generated for the observer's coordinates, not only read from the global event catalogue.
- [x] Selecting a related event opens its event detail.
- [x] The auth gate uses Atlas styling rather than browser-default controls.
- [x] Event detail has a deliberate, readable desktop composition and avoids the purple-dominant placeholder treatment.
- [x] Focused automated tests and rendered desktop verification cover the outcome.

## Tracker note

Synced to Linear as ASV-66 and included in cycle 2.

## Implementation evidence

- `SearchOverlay` now combines the visible synced catalogue with 14 days of coordinate-generated observing targets and groups the next three events under each matching object.
- `objectEventSearch.mjs` owns normalized identifier/name matching, future-event filtering and chronological ordering; its focused unit tests pass.
- `EntryDetailView` now uses a neutral monochrome star field and a centered 72rem desktop canvas instead of stretching its mobile stack across the viewport.
- A 1440x900 Playwright acceptance spec confirms the complete object-search-to-detail flow and asserts that the current auth route renders the styled split Atlas gate.
- `CI=1 CLERK_BACKEND_UNAVAILABLE=1 PLAYWRIGHT_PORT=5186 npm test` passes: 76 unit tests, lint (existing Fast Refresh warnings only), production build, and 62 Playwright tests with 4 deliberate skips.

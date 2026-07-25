---
id: story-paid-location-override
type: story
epic: epic-premium-tiering
title: "Paid: change location from the feed"
status: done
priority: low
---

# Paid: change location from the feed

**As a** paying Atlas user
**I want** to change my location directly from the feed
**So that** I can check conditions somewhere else without navigating to
Settings.

(Confirmed by Liam: "Paid users can change their location from here.")

## Acceptance criteria

- [x] Paid accounts get a "Change location" control on the feed header
      that opens the existing location search input.
- [x] Selecting a city updates the same manual-location preference used
      app-wide (`MANUAL_LOCATION_KEY` via `setManualLocation`), so it's a
      real location change, not a separate throwaway preview.
- [x] Free accounts don't see this control (they still use the existing
      "Change location" link on the Tonight header, unchanged).

## Implementation

`WeekConditionsStrip` gained a `LocationSwitcher` (reuses the existing
`LocationSearchInput` component) shown only when `entitled` and a
`setManualLocation` callback is passed in. `setManualLocation` (from
`useCurrentLocation` in `App.tsx`) is threaded through `TonightView` →
`WeekConditionsStrip` as a new optional prop.

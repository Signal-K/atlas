---
id: story-events-category-filter
type: story
epic: epic-events-overhaul
title: Optional category filter at top of events views
status: done
priority: medium
source: "Notebook page 1, rule 1"
---

# Optional category filter at top of events views

**As an** Atlas user browsing events
**I want** an optional filter at the top of the events list
**So that** I can narrow down to the kinds of events I care about instead
of scrolling everything.

## Acceptance criteria

- [x] Desktop Calendar/Explore view shows a filter chip row (All +
      each event category) above the calendar grid.
- [x] Selecting a category filters both the month's calendar dots and the
      selected day's event list.
- [x] Mobile already had this via `SkyEventBrowser`'s category chips — no
      change needed there.

## Implementation

`src/views/CalendarView.tsx`: added `categoryId` state, a
`filteredEvents` memo using `EVENT_CATEGORIES` from
`src/lib/eventCategories.ts`, and a `.calendar-category-filter` chip row
(styles in `src/App.css`).

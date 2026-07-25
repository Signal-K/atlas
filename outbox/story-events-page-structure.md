---
id: story-events-page-structure
type: story
epic: epic-events-overhaul
title: "Events page: 100% clear structure pass"
status: done
priority: medium
---

# Events page: 100% clear structure pass

**As an** Atlas user browsing events
**I want** the events page to be unambiguous about structure — what's on
it, how it's organized, and how/when I can see each thing
**So that** I'm not confused about what I'm looking at.

## Acceptance criteria

- [x] `CalendarView` now leads with a "Coming up" list grouped into
      Today / Tomorrow / This week / Later, so timing is explicit before
      a user has to click into a specific day.
- [x] The old "click a day to see events" calendar grid is kept, but moved
      below into its own labeled "Browse by month" section — its role
      (browsing further out or into the past) is now separated from
      "what's coming up soon."
- [x] Guide-kind content (comet tracker, night-sky guides — evergreen, not
      dated) no longer renders inside the day-by-day calendar at all; it's
      its own article list (see story-daily-transit-articles).

## Implementation

`src/views/CalendarView.tsx`: added a second data fetch
(`upcomingEvents`, via `getEventsInRange`) independent of the
month-browsing fetch, grouped by `groupUpcoming()`'s relative-day buckets,
rendered above the existing calendar grid. Selecting the "Guides" category
chip now swaps the whole view for `DailyTransitArticles` instead of
filtering the day grid.

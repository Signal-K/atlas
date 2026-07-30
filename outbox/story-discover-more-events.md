---
id: story-discover-more-events
type: story
epic: epic-highlights-and-discovery
title: "\"Discover more\" link from the highlights row"
status: in-progress
priority: low
---

# "Discover more" link from the highlights row

**As an** Atlas user who's seen tonight's 3-4 highlights
**I want** an obvious way to go look at everything else coming up
**So that** the highlights row feels like a preview, not a dead end.

## Acceptance criteria

- [ ] A "Discover more events" link/button sits under the new highlight
      cards, routing to the existing Explore/Events view
      (`/app/explore`).
- [ ] Only shown when the highlight cards are shown (nothing to discover
      more of otherwise).

## Implementation

Added directly to `HighlightCards`/`WeekConditionsStrip` as a
`react-router-dom` `Link` to `/app/explore`, tracked via `trackEvent`
same as the strip's other links (nearby-alert, location switch).

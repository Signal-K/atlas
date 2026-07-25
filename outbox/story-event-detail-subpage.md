---
id: story-event-detail-subpage
type: story
epic: epic-premium-tiering
title: Tap an event to open detail/plan/share subpage
status: done (pre-existing)
priority: high
---

# Tap an event to open detail/plan/share subpage

**As an** Atlas user browsing events
**I want** tapping an event to open a subpage where I can plan it, see
details, and share it
**So that** the list view stays scannable while still letting me go deep
on one event.

## Acceptance criteria

- [x] Tapping an event opens a detail view/sheet, not just an inline
      expand.
- [x] Detail view supports adding it to a plan/watchlist.
- [x] Detail view supports sharing.

## Status

Already implemented pre-session: `src/components/mobile/EventDetailPanel.tsx`
(watch/plan actions) and `src/views/SharePage.tsx` +
`src/components/ShareCard.tsx` (sharing) cover this end to end. Logged here
for traceability against the notes — no code change made this session.

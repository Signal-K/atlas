---
id: story-feed-interests-summary
type: story
epic: epic-feed-redesign
title: Interests summary on feed
status: backlog
priority: low
---

# Interests summary on feed

**As an** Atlas user who has set event-type interests
**I want** to see a short summary of my chosen interests on the feed
**So that** I can confirm/adjust what Atlas is tuning my recommendations
toward, without going into Settings.

## Acceptance criteria

- [ ] Feed shows a compact "Your interests: X, Y, Z" row sourced from the
      user's saved event preferences.
- [ ] Row links/opens the interests editor for quick changes.
- [ ] Hidden (or shows a prompt to set interests) when none are saved yet.

## Notes for implementation

`src/lib/eventPreferences.ts` and `src/components/mobile/EventPreferencePrompt.tsx`
already store/collect interest-like category preferences on mobile — this
story is mostly about surfacing that existing data on the feed header
(`WeekConditionsStrip`) rather than building new storage.

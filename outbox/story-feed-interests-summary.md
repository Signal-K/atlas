---
id: story-feed-interests-summary
type: story
epic: epic-feed-redesign
title: Interests summary on feed
status: done
priority: low
---

# Interests summary on feed

**As an** Atlas user who has set event-type interests
**I want** to see a short summary of my chosen interests on the feed
**So that** I can confirm/adjust what Atlas is tuning my recommendations
toward, without going into Settings.

## Acceptance criteria

- [x] Feed shows a compact "Your interests: X, Y, Z" row sourced from the
      user's saved event preferences.
- [x] Row links/opens the interests editor for quick changes.
- [x] Shows a "Set interests" prompt when none are saved yet.

## Implementation

New shared `InterestsPicker` component (`src/components/InterestsPicker.tsx`)
reads/writes the same store mobile's `EventPreferencePrompt` already used
(`src/lib/eventPreferences.ts` / `favourites.ts`), so a choice made on
either surface shows up on the other. `WeekConditionsStrip` renders an
`InterestsSummary` (inline edit, no navigation needed) using it.

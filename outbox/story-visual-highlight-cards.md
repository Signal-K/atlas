---
id: story-visual-highlight-cards
type: story
epic: epic-highlights-and-discovery
title: Card-style "You can see tonight" highlights
status: in-progress
priority: medium
---

# Card-style "You can see tonight" highlights

**As an** Atlas user opening the feed
**I want** tonight's top events shown as small cards (icon, date, title)
instead of one text line
**So that** the highlights read at a glance the way a reference sky-events
graphic does, not like a sentence I have to parse.

## Acceptance criteria

- [ ] Replaces `.feed-highlights` text line in `WeekConditionsStrip` with a
      row of cards, one per today's top targets (existing
      `plan.targets`/diversified event list, capped at 3-4).
- [ ] Each card shows a category icon (reusing the existing outline icon
      set), the event's date/time, and its title — no new photography
      assets required for this pass (see story-premium-example-photos for
      real reference photos, which is premium-only).
- [ ] "Guide" filler kinds (comet tracker, generic night-sky guides) are
      excluded from the card row — it's for real dated events, matching
      how `EVENT_CATEGORIES`/`GUIDE_KIND_IDS` already separate them
      elsewhere.
- [ ] Hidden when there's nothing to show, same as today's behavior.

## Implementation

New `HighlightCards` component (`src/components/HighlightCards.tsx`),
reusing `MobileIcon` for category glyphs and `categoryForKind`/
`GUIDE_KIND_IDS` from `eventCategories.ts` to pick the icon and filter out
guide-kind filler. Wired into `WeekConditionsStrip` in place of the old
`.feed-highlights` paragraph.

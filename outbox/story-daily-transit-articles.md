---
id: story-daily-transit-articles
type: story
epic: epic-events-overhaul
title: Ability to see Daily Transit articles from the Atlas app
status: done
priority: low
source: "Notebook page 1, bottom block (clarified by Liam in chat)"
---

# Ability to see Daily Transit articles from the Atlas app

**As an** Atlas user
**I want** to read Daily Transit articles from inside the app
**So that** I can access that editorial/guide content without leaving
Atlas.

(Clarified by Liam: "Ability to see the daily transit articles from the
atlas app" — resolves what was illegible in the original photo as "TOT
catalog".)

## Interpretation

"Daily Transit" is currently only a design-system name in this codebase
(`src/mobile.css`), not a separate content source. The closest real
content that matches "articles" is the existing "Guides" event category —
evergreen, non-dated pointer content (comet tracker, night-sky guides,
local night-sky roundups: `GUIDE_KIND_IDS` in `src/lib/eventCategories.ts`)
that previously rendered awkwardly inside the day-by-day calendar (a
recurring bug the codebase comments already flagged). This story gives
that content its own proper reading surface instead of building a new,
unrelated content type from scratch.

## Acceptance criteria

- [x] Selecting the "Guides" filter on the desktop Events view shows a
      dedicated article list, not a filtered calendar day.
- [x] Each article shows its image (if any), kind label, title, and full
      body text.
- [x] Guides no longer appear mixed into specific calendar days.

## Implementation

New `src/components/DailyTransitArticles.tsx`, wired into
`src/views/CalendarView.tsx` so choosing the "Guides" category swaps the
whole view for the article list.

## If this isn't what was meant

If "Daily Transit articles" actually refers to a different, separate
content source (an external CMS/blog), this implementation should be
revisited — it currently repurposes existing guide-kind `SkyEvent` data
rather than fetching new content.

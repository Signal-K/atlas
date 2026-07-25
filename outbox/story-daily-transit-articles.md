---
id: story-daily-transit-articles
type: story
epic: epic-feed-redesign
title: Ability to see Daily Transit articles from the Atlas app
status: backlog
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

## Open questions (need product input before scoping acceptance criteria)

- Where do Daily Transit articles currently live — a CMS, a separate site,
  static files? "Daily Transit" is currently only a design-system name in
  this codebase (`src/mobile.css`, `Atlas Events Feed - Design Language`
  references) — there is no existing article content or fetch layer for it.
- Is this the same content as the existing "Guides" event category
  (`night_sky_guide`, `comet`, `local_night_sky` kinds in
  `src/lib/eventCategories.ts` — the recurring "check an external source"
  pointer cards), just needing a dedicated in-app reading view? Or is it
  genuinely separate editorial content (longer-form articles, not
  event-linked guide cards)?
- Should this live inside an existing tab (e.g. a new panel on the Today
  hub) or as its own top-level surface?

## Status

Not started — deliberately left as an open backlog item rather than
guessed-at implementation, since the acceptance criteria depend on where
the article content actually comes from.

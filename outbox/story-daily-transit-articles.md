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
**So that** I can access that editorial content without leaving Atlas.

(Clarified by Liam, in two passes: first "Ability to see the daily transit
articles from the atlas app", then "TDT - thedailytransit.com, part of
signal-k/daily repo" → corrected to `signal-k/saily`.)

## Correction

An earlier version of this story/implementation guessed that "Daily
Transit" meant Atlas's own evergreen "Guides" event content (comet
tracker, night-sky guides) — that was wrong. TDT is a real, separate
Signal-K product: thedailytransit.com, a Next.js app in the
`signal-k/saily` monorepo (which also hosts the unrelated Saily
citizen-science puzzle game — the two products share that repo and a
Melbourne/AEST-midnight daily-reset convention, but are otherwise
distinct). This version replaces that guess with an actual integration.

## Acceptance criteria

- [x] Fetches real published articles from TDT's production PocketBase
      (`cms_articles` collection, public `status = "published"` read rule
      — same pattern TDT's own frontend uses in `web/src/lib/cms.ts`).
- [x] Shows title, summary, and hero image for the latest articles.
- [x] Links out to the full article on thedailytransit.com rather than
      duplicating TDT's markdown/CMS rendering inside Atlas.
- [x] Fails quietly (empty state, not a crash) if TDT's backend is
      unreachable.
- [x] Atlas's own "Guides" event category (comet tracker, night-sky
      guides) reverted to its original behavior — it's unrelated content
      and shouldn't have been conflated with TDT.

## Implementation

`src/lib/dailyTransit.ts`: `fetchDailyTransitArticles()` hits
`https://signal-k-saily.fly.dev/api/collections/cms_articles/records`
directly (verified reachable with open CORS from a browser origin).
Production PocketBase URL found via `signal-k/saily`'s
`.github/workflows/science-feed-ingestion.yml` and a memory note
referencing `https://signal-k-saily.fly.dev`; overridable via
`VITE_DAILY_TRANSIT_PB_URL` if that ever changes.
`src/components/DailyTransitArticles.tsx` renders the result; wired into
`src/views/CalendarView.tsx` as an always-visible "The Daily Transit"
panel above the category filter (not gated behind any chip).

## Known gap

At the time of writing, TDT has zero published articles
(`thedailytransit.com/articles` itself shows "No articles published
yet."), so the panel currently renders its empty state in production.
That's expected — nothing to fix on the Atlas side.

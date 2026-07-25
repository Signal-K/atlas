---
id: epic-feed-redesign
type: epic
title: Tonight/Feed redesign
status: in-progress
priority: high
source: "Notebook page 2, 'Corrected Atlas User Flow'"
---

# Tonight/Feed redesign

The first thing a user should onboard into is the feed (Atlas's "Tonight"
screen). The notes describe it needing a full pass so it reads as a
personal daily briefing rather than a raw data dump:

- A greeting header: "Hi, {name}. Today it's {weather condition}."
- A one-line "you can see: X, Y" summary of tonight's best targets.
- A summary of the user's chosen interests.
- A week-ahead conditions strip, three metrics per day (light
  pollution/moonlight, optimal viewing time, cloud coverage), with a visible
  cutoff between what free and paid accounts can see.
- A simplified sky/star map: direction + altitude only by default, with
  cloud coverage revealed on tap rather than shown by default.

## Child stories

- story-feed-greeting-header
- story-feed-today-highlights
- story-feed-interests-summary
- story-feed-week-conditions-strip
- story-feed-simplified-sky-map

## Status

Greeting header, today highlights, and the week conditions strip shipped
in this session as `WeekConditionsStrip` (`src/components/WeekConditionsStrip.tsx`),
wired into `TonightView`. Interests summary and sky map simplification are
still backlog — see their individual story files.

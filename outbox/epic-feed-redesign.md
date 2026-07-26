---
id: epic-feed-redesign
type: epic
title: Tonight/Feed redesign
status: done
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
- story-feed-day-grouping-improvements

## Status

All five original child stories are done. Greeting, highlights, interests
summary, and the week conditions strip live in `WeekConditionsStrip`
(`src/components/WeekConditionsStrip.tsx`), wired into `TonightView`. The
simplified sky map's tap-to-reveal cloud coverage lives directly in
`TonightView`'s target detail section. A sixth story
(story-feed-day-grouping-improvements) was added later from a follow-up
chat review of the shipped redesign — clearer day dividers and no silent
empty days in the Events/Plan browse feed.

---
id: story-feed-today-highlights
type: story
epic: epic-feed-redesign
title: "\"You can see\" today highlights"
status: done
priority: high
---

# "You can see" today highlights

**As an** Atlas user opening the app
**I want** a one-line summary of tonight's best targets right under the
greeting
**So that** I don't have to scroll the full target list to know if
tonight is worth it.

## Acceptance criteria

- [x] Shows up to 3 of tonight's top targets by name (e.g. "You can see:
      Jupiter, ISS pass, Orion Nebula tonight.").
- [x] Hidden when there are no targets tonight, rather than showing an
      empty/awkward line.

## Implementation

`WeekConditionsStrip` reads the top 3 entries from the existing
`TonightPlan.targets` (already ranked) and renders them as the
`.feed-highlights` line.

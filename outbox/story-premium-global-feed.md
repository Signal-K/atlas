---
id: story-premium-global-feed
type: story
epic: epic-premium-tiering
title: "Premium: location-agnostic global events feed (desktop)"
status: in-progress
priority: medium
source: "Liam, in chat: 'a section on desktop that shows a global feed, location agnostic, that shows all real events (i.e. more than just stars being visible)', premium-only"
---

# Premium: location-agnostic global events feed (desktop)

**As a** Sky Pass user on desktop
**I want** a feed of every genuinely global sky event coming up — not
just what's near my current location
**So that** I can see the full picture (eclipses, meteor showers,
conjunctions, aurora/space-weather activity) regardless of where Atlas
currently has me located.

## Scope notes

"Global" here means events that don't depend on the viewer's location at
all — eclipses, meteor shower peaks, conjunctions, moon phases, asteroid
approaches, solar flares. ISS passes and satellite flares are
deliberately excluded: those are only meaningful for a specific location
and would be misleading in a location-agnostic feed. This reuses the
existing convention (`SkyEvent.latitude/longitude` both `undefined` =
genuinely global, see `sync.ts`'s comment on why `(0,0)` is treated as
"no location") rather than introducing new data modeling.

"Real events" excludes the `Guides` category (comet tracker, generic
"what's visible tonight" filler) the same way the new highlight cards do
— see `GUIDE_KIND_IDS` in `eventCategories.ts`.

## Acceptance criteria

- [ ] New desktop-only widget/section, gated on `user?.entitled`, listing
      upcoming global real events over an extended window (60 days —
      long enough to include the next eclipse/meteor peak even in a slow
      stretch, short enough to stay a bounded query).
- [ ] Free users see a locked/teaser version pointing at Sky Pass, same
      pattern as `WeekConditionsStrip`'s other paid gates.
- [ ] Reuses `HighlightCards` for the card rendering so the visual
      language matches the highlights row.

## Implementation

New `GlobalEventsFeedWidget` (`src/widgets/GlobalEventsFeedWidget.tsx`),
registered via the existing widget registry (`src/widgets/registry.ts`)
so it appears on `DashboardView` and can be reordered/hidden like any
other widget. Filters `getEventsInRange` results to
`latitude == null && longitude == null`, excludes guide kinds, and caps
the window at 60 days.

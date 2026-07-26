---
id: story-feed-day-grouping-improvements
type: story
epic: epic-feed-redesign
title: Clearer day segmentation and no empty days in the events feed
status: done
priority: medium
source: "Liam, in chat, after reviewing the shipped feed redesign"
---

# Clearer day segmentation and no empty days in the events feed

**As an** Atlas user browsing the Events/Plan feed
**I want** each day to read as a clearly separated block, and every day to
have something in it
**So that** the feed doesn't feel broken (days silently missing) or blur
together (no visual break between one day and the next).

Two related complaints, same underlying component (`SkyEventBrowser`,
shared by `EventsView` and `PlanView`'s browse mode):

1. "Days need to be more clearly segmented, like the feed in Threads."
2. "I'm sure there's more astronomical activity... there should never
   really be empty days unless conditions truly are terrible."

## Acceptance criteria

- [x] Day-group dividers ("TODAY" / "TOMORROW" / "TUE, JUL 28"...) read as
      clearly bounded sections with real spacing between groups, not a
      thin label easy to miss.
- [x] Every day in the browsed window has at least one entry unless a
      real event already covers it — no silent gaps.
- [x] The filler content is still real astronomical information (visible
      planets and brightest above-horizon stars for that night), not
      placeholder text.

## Implementation

**Segmentation** (`src/mobile.css`'s `.dt-today-rule`): was a thin label
plus a hairline rule with a 2px bottom margin, so consecutive days ran
together. Now a pill badge (`background: var(--dt-rule)`, rounded,
theme-aware) with 28px/12px top/bottom margins, closer to how feed apps
like Threads separate chronological sections. Verified with a Playwright
screenshot against the live feed.

**No empty days**: added `buildDailySkyGuideEvents` in
`src/lib/visiblePlanets.ts`, generating one "Visible tonight"/"Visible
[weekday]" filler event per day across the browsed window
(`SKY_GUIDE_WINDOW_DAYS = 14`, matching `SkyEventBrowser`'s own calendar
strip), describing visible-above-horizon planets and the brightest
visible stars (`describeVisibleSky`, extended from the existing
single-day `buildVisiblePlanetsEvent`/`describeVisiblePlanets` used
elsewhere). Wired into `EventsView` and `PlanView`, filtered so a filler
is only added for a day that doesn't already have a real scheduled event
— never duplicates real content. Verified end-to-end with a Playwright
run: every day in a 10-day window now has an entry, and opening a filler
shows real computed planet/star positions.

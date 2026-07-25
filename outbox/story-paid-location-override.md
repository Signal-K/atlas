---
id: story-paid-location-override
type: story
epic: epic-premium-tiering
title: "Paid: change/preview location from the feed"
status: backlog
priority: low
---

# Paid: change/preview location from the feed

**As a** paying Atlas user
**I want** to change or preview a different location directly from the
feed
**So that** I can check conditions somewhere else (a trip destination, a
family member's city) without leaving the screen.

## Acceptance criteria

- [ ] Paid accounts get an inline location picker on the feed/Tonight
      screen that temporarily previews conditions for another location.
- [ ] Free accounts keep the existing "Change location" link that routes
      to Settings (current behavior, unchanged).
- [ ] Reverting back to the real/default location is one tap.

## Notes for implementation

`TonightView` already has a "Change location" link to `/settings`
(`.tonight-location-heading`). `DashboardView`'s `LocationPicker` +
`WorldMap` + `locationBrowseContext.tsx` already implement a "browse
another city" pattern for the community/discovery surfaces — the paid
version of this story is likely reusing that same
`LocationBrowseProvider` pattern for the Tonight/feed screen, gated behind
`user.entitled`, rather than building a new picker from scratch.

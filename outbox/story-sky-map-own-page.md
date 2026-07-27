---
id: story-sky-map-own-page
type: story
epic: epic-sky-map-standalone-page
title: Sky map opens at a real, bookmarkable URL
status: done
priority: medium
---

# Sky map opens at a real, bookmarkable URL

**As an** Atlas user
**I want** the full sky map to be its own page
**So that** I can bookmark it, share a link to it, and use the browser
back button instead of it only being reachable through a modal I have to
re-open every time.

## Acceptance criteria

- [x] Opening the sky map navigates to `/sky-map` rather than only
      flipping local component state.
- [x] Loading `/sky-map` directly (bookmark, shared link, fresh tab)
      renders correctly rather than 404ing or landing on a blank state.
- [x] Closing it returns to the Today tab.

## Implementation

`src/views/mobile/HubView.tsx`: replaced the local `mapOpen` boolean
with `location.pathname === '/sky-map'` (via `useLocation`), and the
"Tap for full sky map" trigger now calls `navigate('/sky-map')` instead
of `setMapOpen(true)`; `onClose` navigates to `/today`.

No new route registration was needed: `MobileShell`'s existing
`tabFromPathname()` already falls back to the Hub tab for any
unrecognized pathname, so `/sky-map` renders the Hub view underneath
(which is what fetches the `plan`/`clarity`/`topTarget` data the map
overlay needs) with the map open on top -- works identically whether
you tapped into it from the Hub or loaded the URL cold. Kept the actual
`SkyMapOverlay` component and its data flow completely unchanged, only
swapping what decides whether it's open.

## Known gap

Desktop has no equivalent -- see epic-sky-map-standalone-page's status
note.

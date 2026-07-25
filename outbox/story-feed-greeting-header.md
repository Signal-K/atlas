---
id: story-feed-greeting-header
type: story
epic: epic-feed-redesign
title: Feed greeting header
status: done
priority: high
---

# Feed greeting header

**As a** returning Atlas user
**I want** the Tonight/feed screen to greet me by name with today's
conditions
**So that** the app feels personal instead of a raw dashboard.

## Acceptance criteria

- [x] Header reads "Hi, {name}. Today it's {weather condition} near
      {city}." when a name is set.
- [x] Falls back to "Hi. Today it's..." when no name is set yet.
- [x] Weather condition derives from the existing today-advisory quality
      (clear / partly cloudy / cloudy).
- [x] User can set/edit their display name inline from the header.

## Implementation

`src/components/WeekConditionsStrip.tsx` (`NameEditor` + greeting line),
backed by `src/lib/displayName.ts`. Wired into `src/views/TonightView.tsx`.
Name is a local-only preference (no PocketBase field yet — see
story-onboarding-name for the follow-up).

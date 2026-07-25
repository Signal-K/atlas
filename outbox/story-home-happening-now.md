---
id: story-home-happening-now
type: story
epic: epic-premium-tiering
title: Home shows what's happening now/upcoming soon
status: done (pre-existing)
priority: high
---

# Home shows what's happening now/upcoming soon

**As an** Atlas user opening the app
**I want** the home screen to lead with what's happening right now or
coming up soon
**So that** I don't have to dig for "is anything worth seeing tonight."

## Acceptance criteria

- [x] Home/Tonight screen leads with a rating ("Go outside — great
      conditions" / "Skip tonight" / etc.) and ranked near-term targets.
- [x] Twilight-right-now and general best-photo-window states are
      surfaced when relevant.

## Status

Already implemented pre-session via `TonightView`
(`src/views/TonightView.tsx`) and `getTonightPlan`
(`src/lib/tonightTargets.ts`). Logged here for traceability against the
notes — no code change made this session.

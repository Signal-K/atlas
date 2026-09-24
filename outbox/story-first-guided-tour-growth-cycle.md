---
id: story-first-guided-tour-growth-cycle
type: story
epic: epic-guest-experience
title: Complete the first guided-tour growth loop
status: done
priority: high
source: "Linear cycle 2: ASV-55 ASV-56 ASV-57 ASV-58 ASV-59 ASV-60 ASV-62 ASV-63 ASV-64 ASV-65"
external_tracker: Linear
---

# Complete the first guided-tour growth loop

**As a** new Atlas observer
**I want** one clear guided look for tonight
**So that** I reach a useful when/where/what plan before Atlas asks me for an account.

## Acceptance criteria

- [x] A cold visitor can enter the guest tour from the landing page in no more than two taps.
- [x] The tour makes location, timing, target selection, and completion explicit without a dashboard-style progress bar.
- [x] Tour funnel events carry the locked `tour_id`, location, identity, and incentive properties.
- [x] First completion unlocks a persistent First light badge once, merges to a new account, and does not replay the celebration.
- [x] Completion offers a concrete next guided look and a mobile share link that reopens the tour.
- [x] Focused unit and browser tests cover guest entry, completion, persistence, sharing, and the reported desktop/object-search fixes.

## Tracker state

Linear is the delivery board for this cycle. This Desk outbox story is the local system-of-record mirror required by the repository workflow.

## Implementation evidence

- Guest landing entry opens `/app/hub?tour=tonight` in two taps while preserving the sign-in-first choice.
- Hub owns the `entry → where → when → what → completed` funnel, explicit completion, abandonment context, a one-time First light unlock, next-look nudge, and share/open tracking.
- `atlas-first-tour-completion-v1` persists guest completion; signup merges it to `users.first_tour_completed_at` and `users.first_tour_badge` through the new PocketBase migration.
- PostHog insight `BiE4ClcU` is live on the Atlas Analytics dashboard for `Tour started → Tour completed`, filtered to `youratlas.cc`.
- Rendered acceptance captured the 390×844 guided-tour and completion states plus 1440×900 object-search detail.
- `CI=1 CLERK_BACKEND_UNAVAILABLE=1 PLAYWRIGHT_PORT=5186 npm test` passes: 76 unit tests, lint (existing Fast Refresh warnings only), production build, and 62 Playwright tests with 4 deliberate skips.

---
id: story-tonight-window-timezone-fallback
type: story
epic: epic-ci-test-reliability
title: Fix e2e mocks missing Open-Meteo timezone, truncating the tonight window
status: done
priority: medium
---

# Fix e2e mocks missing Open-Meteo timezone, truncating the tonight window

## What was happening

CI run 30238604971 (and the run before it, 30238405744) both failed the
same 8 e2e tests broadly: `.tonight-target-main` / `.dt-feed-row` never
appeared, with the plan screen instead showing "No events found for
tonight in the local cache yet." Reproduced locally on the current HEAD,
then on commit `5eeda54` (the last commit with a clean CI pass of this
exact suite) via a `git worktree` checkout -- it failed there too,
proving this predates any of this session's camera-recipe / sky-map /
skyMapSearch work.

## Root cause

`getTonightPlan` (`src/lib/tonightTargets.ts`) computes "tonight"'s end
boundary via `tonightWindowForTimeZone(now, locationTimeZone ??
forecast.timeZone)`. Neither half of that fallback was ever populated in
these e2e tests:

- `src/lib/cities.ts` city entries carry no `timeZone` field at all.
- The tests' mocked Open-Meteo response bodies only included `daily:
  {...}`, never the `timezone` field that the real API returns (Open-Meteo
  is called with `&timezone=auto` specifically to get this).

With both undefined, `tonightWindowForTimeZone` fell back to its
no-timezone branch, which uses the *test browser's own local clock* (UTC
in CI/this sandbox) to compute "6am" as the end of tonight -- instead of
the target city's actual local 6am. Depending on what UTC hour the test
happens to run at, that produces anywhere from a nearly-full night down
to a window of well under an hour. The mocked sky event starts 2 hours
from "now," so on any run where the browser's UTC hour left less than ~2
hours until UTC 06:00, the event fell outside the computed window and
got silently filtered out of `plan.targets`, exactly matching the
observed failure. This explains why the same commit passed in an earlier
CI run and failed in a later one on the same code: it depends on the
time of day the job happens to execute, not on any code change.

## Fix

Added `timezone: 'Europe/London'` to the mocked Open-Meteo response body
in every e2e spec that mocks it (`first-plan-journey`,
`mobile-activation-flow`, `plan-screen`, `signup-journey`,
`landing-location-flow`, `mobile-sky-map`, `reminder-loop`,
`product-screenshots`), matching what the real API always sends. This
gives `tonightWindowForTimeZone` a real IANA zone to compute a full
evening-to-6am window from, regardless of what wall-clock time the test
happens to run at.

Verified locally: all previously-failing specs
(`first-plan-journey.spec.ts`, `mobile-activation-flow.spec.ts`,
`plan-screen.spec.ts`, `signup-journey.spec.ts`) now pass.

Not touched: production code. `tonightWindowForTimeZone`'s no-timezone
fallback is a reasonable behavior for a real offline/no-forecast user (no
real IANA zone to fall back to) -- this was purely a gap in test fixtures
not mirroring what the real Open-Meteo API always returns.

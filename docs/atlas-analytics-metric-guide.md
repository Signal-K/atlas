# Atlas Analytics: what "good" looks like (ASV-28)

Quick reference for the saved insights on the
[Atlas Analytics dashboard](https://us.posthog.com/project/199773/dashboard/2093974)
(all filtered to Atlas hosts only, per ASV-20).

## Isolation decision (ASV-20)

Cycle 1 ships **option 2: host filter on the shared Default project**
(`199773`). A dedicated Atlas PostHog project is still the long-term
preference, but it is not available through the MCP and is not required for
clean Atlas dashboards/funnels/replays today. Filter every Atlas artifact
with `$host icontains "atlas"` (covers `youratlas.cc` and
`*.atlas-4xz.pages.dev`). Do not read unfiltered web overview as Atlas.

## Cycle 1 funnel note (ASV-24, 30 days to 18 Sep 2026)

Landing 66 → CTA 24 (36%) → Tonight started 1 (1.5%) → plan succeeded 1 →
paywall checkout 0. Biggest drop-off is **CTA → Hub/Tonight**, not paywall.
Paths: landing ↔ `/` bounce, or `/app/events` without a generated plan.
Volume is still too low to treat this as a pricing problem.

| Insight | What it shows | What "good" looks like |
|---|---|---|
| Atlas activation funnel | Landing -> CTA -> Tonight viewed -> plan generated (value moment) -> paywall reached | Biggest drop-off should be *late* (paywall), not early (landing->CTA) -- an early cliff means the pitch/CTA is the problem, not the pricing |
| Atlas navigation paths | Wander patterns from landing/pageviews | A visible path from landing straight into `/app/hub` or `/app/events` without detours; long branchy paths through settings/account before reaching a plan suggest friction, not exploration |
| Tonight plans by city | Value-moment volume broken down by city | Concentration in a few cities is expected early on; a long tail with no repeats suggests low retention rather than broad reach |
| Tonight plan rating distribution | `great`/`good`/`maybe`/`skip` share at the value moment | Healthy if `great`/`good` dominate -- a `skip`-heavy distribution means Atlas is generating plans users shouldn't act on, which will show up as paywall/retention drop-off later |
| Tonight plan targetCount distribution | Median/p90 targets per generated plan | A few targets (not zero, not overwhelming) -- 0 means the plan generator found nothing to suggest (a bug or dead night), a very high p90 may mean the UI needs better prioritization |
| Share events volume | `Shared city stamp` / `Shared public card` / `Viewed public share card` | Any sustained non-zero volume is a positive signal at this traffic level -- it's Atlas's only unpaid acquisition loop; watch for shares that don't convert to `Viewed public share card` views, which would mean the share content itself isn't compelling |
| Paywall checkout clicks by feature | Which gated `feature` people click checkout from | A feature with disproportionate clicks relative to its exposure is the strongest signal yet for what to build/market next -- see ASV-27 |

## Secondary/depth events (not on their own tiles yet)

`Opened camera recipe` and `Added get ready reminder` are available as
breakdowns on the funnel/paths insights above rather than standalone tiles
-- add dedicated insights once volume makes them worth a tile of their own.

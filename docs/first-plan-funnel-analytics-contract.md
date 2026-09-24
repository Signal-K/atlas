# Atlas value moment + guided-tour funnel: analytics contract (ASV-23, ASV-24, ASV-55, ASV-59)

All events go through `trackEvent(name, properties)` in `src/lib/analytics.ts`,
which forwards to PostHog. Naming follows the sentence-case convention already
used across the codebase ("Viewed landing page", not `viewed_landing_page`).

> This doc previously documented a funnel built against the pre-rebuild view
> set (`TonightView.tsx`, `mobile/HubView.tsx`, `SignupWallModal.tsx`, the
> `Generated tonight plan` / `Tapped visible target` events). ASV-2 (frontend
> rebuild: unify design system, consolidate to 5 areas) replaced those views
> with a single shared `HubPage.tsx` + `AuthForm.tsx` + `PaywallGate.tsx`, and
> none of the old event names fire anymore. This rewrite reflects the current
> codebase as of ASV-23/24.

## Value moment

**Definition (ASV-23):** a user generates a Tonight plan with a real location
set — `Tonight plan generation succeeded` fired with `hasLocation: true`.

This is the primary early-stage success event. It's the terminal step of the
funnel below, and the primary conversion event for the funnel/paths insights
built in ASV-24. Signup is deliberately **not** the funnel's terminal event —
the product question is "how many people reach a plan," not "how many sign
up." A visitor who never creates an account but reaches a generated plan has
still hit the value moment.

Required properties: `hasLocation` (boolean — `false` when `city.source ===
'default'`, i.e. no geolocation/manual/trip location was ever set). `city`,
`rating`, `targetCount` ride along for free segmentation.

## Primary value moment (ASV-59)

The primary Atlas value moment is now **the first guided tour completed with a real location and an explicit when/where/what plan**. The canonical event is `Tour completed`; `tour_id`, `location_present`, `account_state`, and `incentive_eligible` are required on every tour funnel event. A generated Tonight plan remains useful diagnostic context, but is no longer the conversion itself.

## Core guided-tour funnel (ASV-55), in order

| Step | Event | Required properties |
| --- | --- | --- |
| Entry | `Tour started` | `tour_id`, `location_present`, `account_state`, `incentive_eligible`, `source` |
| Progress | `Tour step viewed` | core properties + `step_id` (`entry`, `where`, `when`, `what`) |
| Value moment | `Tour completed` | core properties + `target_id` |
| Exit context | `Tour abandoned` | core properties + `last_step_id` |
| Unlock | `Incentive unlocked` | core properties + `type=first_tour`, `badge=first_light` |
| Return | `Return nudge shown` | core properties + next `target_id` when available |
| Sharing | `Tour shared` / `Tour share opened` | core properties + `target_id` |

The saved PostHog insight is provisioned idempotently with `scripts/posthog-tour-funnel-setup.mjs`; it filters `$host=youratlas.cc` and measures `Tour started → Tour completed` over 30 days without an invented target rate.

## Legacy activation funnel (ASV-24), in order

Filter every step to Atlas traffic (`$host = youratlas.cc`, see ASV-20) —
without it, Landnam's game events dilute the funnel.

| Step | Event | Properties | Fired from | Status |
|---|---|---|---|---|
| 1. Landing view | `Viewed landing page` | `authenticated` | `views/LandingPage.tsx` | ✅ live |
| 2. Landing CTA | `Landing CTA clicked` | `method: 'open_app' \| 'get_started'`, `source` | `views/LandingPage.tsx` | ✅ live |
| 3. Viewed Tonight/Hub | `Tonight plan generation started` | `source: 'mobile_hub'` | `pages/HubPage.tsx` | ✅ live (fires on every Hub mount, stands in for a pageview) |
| 4. Value moment | `Tonight plan generation succeeded` | `source`, `targetCount`, `city`, `rating`, `hasLocation` | `pages/HubPage.tsx` | ✅ live (`city`/`rating`/`hasLocation` added ASV-23/28) |
| 4b. Failure (funnel drop-off context) | `Tonight plan generation failed` | `source`, `error` | `pages/HubPage.tsx` | ✅ live |
| 5. Paywall reached | `Paywall checkout clicked` | `feature` | `components/PaywallGate.tsx`, `views/AccountSettings.tsx` | ✅ live |

Also added for ASV-27 (paywall reached, not just clicked-through):

| Event | Properties | Fired from | Status |
|---|---|---|---|
| `Paywall viewed` | `feature` | `components/PaywallGate.tsx` | ✅ live (added ASV-27) — fires once per gate shown to a non-entitled user |
| `checkout_start_failed` | `feature`, `error`, `fellBackToStaticLink` | `components/PaywallGate.tsx`, `views/AccountSettings.tsx` | ✅ live |

**Paths insight (ASV-24):** build a Paths insight starting from `Viewed
landing page` / `Tonight plan generation started` to see how visitors wander
between tours, sky tools, and the account wall, instead of only the linear
funnel above.

## Secondary depth/engagement events

Not funnel steps, but useful breakdowns on the events above (per ASV-24,
ASV-28):

| Event | Properties | Fired from |
|---|---|---|
| `Opened camera recipe` | `recipeKey` | `components/CameraRecipe.tsx` |
| `Added get ready reminder` | `target`, `device` | `views/DeepSkyPlannerView.tsx` |
| `Shared city stamp` / `Shared public card` | — | share flow (`components/PostShareDialog.tsx` and related) |
| `Viewed public share card` | `found` | `views/SharePage.tsx` |
| `Blocked free plan add` | `action`, `source` | `mobile/SearchOverlay.tsx`, `pages/EventsPage.tsx`, `pages/HubPage.tsx` |

## Sign-up / identity events (context, not funnel steps)

| Event | Properties | Fired from |
|---|---|---|
| `Account form started` / `Account form submitted` | `source`, `mode` | `components/AuthForm.tsx` |
| `Sign in completed` / `Sign up completed` | `source`, `demoAccess` / `mergedCount` | `components/AuthForm.tsx` |
| `Sign in failed` / `Sign up failed` | `source` | `components/AuthForm.tsx` |
| `Merge result` | `source`, `favourites`, `watchlist`, `observations`, `cameraPresets`, `targetTaps`, `equipmentChoice`, `total` | `components/AuthForm.tsx` |
| `Completed welcome beat` | `mergedCount?` | `components/SignupWelcomeBeat.tsx` |

`identifyAnalyticsUser` (ASV-21) fires from `useEntitlementSync` on every
`user` state change, which lands right after `Sign in completed` / `Sign up
completed` update the auth store — signed-in Atlas users are identified in
PostHog (`atlas_user_id`, `email`, `entitled`) without a separate call site.

## Required properties, by event

Every event above lists its required properties in the table. None of the
live events currently include PII beyond a city name (already public,
user-entered) and an email set only via `posthog.identify()` on sign-in
(ASV-21) — no email/name is ever passed as a `trackEvent` property.

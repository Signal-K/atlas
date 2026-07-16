# First-plan funnel: analytics contract (STS-335)

All events go through `trackEvent(name, properties)` in `src/lib/analytics.ts`,
which forwards to PostHog. Naming follows the sentence-case convention already
used across the codebase ("Viewed Tonight page", not `viewed_tonight_page`).

Signup is deliberately **not** the funnel's terminal event — the product
question is "how many people reach a first plan," not "how many sign up." A
visitor who never creates an account but reaches a generated plan has
completed the funnel this contract measures.

## Funnel events, in order

| Step | Event | Properties | Fired from | Status |
|---|---|---|---|---|
| Landing CTA | `Landing CTA clicked` | `method: 'manual_city' \| 'browser_geolocation'`, `city?`, `isMobile` | `LandingPage.tsx` | ✅ live |
| Landing view (context for CTA rate) | `Viewed landing page` | `isMobile` | `LandingPage.tsx` | ✅ live |
| Feed load | `Viewed Tonight page` | `city` | `TonightView.tsx` (desktop) | ✅ live |
| Feed load (mobile) | — | — | `mobile/HubView.tsx` | ⚠️ gap — no page-view event on mobile hub load |
| First target tap | `Tapped visible target` | `targetId`, `title`, `kind`, `source: 'tonight' \| 'mobile_hub'` | `TonightView.tsx`, `mobile/HubView.tsx` | ✅ live |
| Equipment answer | `Answered equipment prompt` | `choice`, `source` | `TonightView.tsx`, `mobile/HubView.tsx` | ✅ live |
| Equipment skip | `Skipped equipment prompt` | `source` | `TonightView.tsx`, `mobile/HubView.tsx` | ✅ live |
| Plan generation | `Generated tonight plan` | `rating`, `targetCount`, `city` | `TonightView.tsx` | ✅ live (added this session) |
| Reminder request | `Added get ready reminder` | `target`, `hasPermission`, `source: 'desktop_planner' \| 'mobile_plan' \| 'mobile_events'` | `DeepSkyPlannerView.tsx`, `mobile/PlanView.tsx`, `mobile/EventsView.tsx` | ✅ live (mobile wired this session) |
| Signup trigger (shown) | `Signup wall shown` | `reason: 'favourite' \| 'log_observation'` | `SignupWallModal.tsx` | ✅ live |
| Signup trigger (submitted) | `Signup wall submitted` | `reason`, `mode` | `SignupWallModal.tsx` | ✅ live |
| Signup trigger (dismissed) | `Signup wall dismissed` | `reason` | `SignupWallModal.tsx` | ✅ live |
| Merge result | `Merge result` | `source`, `favourites`, `watchlist`, `observations`, `cameraPresets`, `total` | `SignupWallModal.tsx` | ✅ live (added this session) |
| Welcome completion | `Completed welcome beat` | `mergedCount?` | *no welcome beat exists yet* | ❌ not built — `OnboardingModal.tsx` is currently unmounted dead code, not a real welcome step |
| Notification sent | `Get-ready notification shown` | `eventId`, `title` | `getReadyReminders.ts`'s `scheduleReminder` | ❌ not built — fires from a bare `setTimeout` with no analytics call, and can't reliably fire if the tab is closed |
| Feedback response | `Answered viewing check-in` | `eventId`, `sawIt: boolean` | *no post-window check-in exists yet* | ❌ not built — STS-305's "feedback check-in" half isn't implemented, only the pre-window reminder is |

## Gaps this contract surfaces (not yet closed)

1. **Mobile feed-load event** — `mobile/HubView.tsx` has no page-view
   equivalent to desktop's `Viewed Tonight page`, so mobile funnel entry can't
   be measured the same way. Low effort to add; not done in this pass to keep
   this session's diff scoped to what STS-335 asked to *define*.
2. **Welcome beat** doesn't exist as a real product step (see `OnboardingModal.tsx`'s
   own comment — it's unmounted). `Completed welcome beat` is a placeholder
   name for whenever that surface is built.
3. **Notification-sent and feedback-response** depend on the post-reminder
   check-in loop described in STS-305, which is only half-built (the
   reminder itself, not the "did you see it?" follow-up). Event names above
   are reserved so whoever builds that surface doesn't have to invent naming.

## Required properties, by event

Every event above lists its required properties in the table. None of the
live events currently include PII beyond a city name (already public,
user-entered) — no email/name is ever passed as an event property (email is
only attached via PostHog's `$set` in `subscribeForUpdates`, a distinct,
already-existing opt-in flow, not part of this funnel).

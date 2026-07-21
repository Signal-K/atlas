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
| Feed load | `Viewed Tonight page` | `city`, `surface?` | `TonightView.tsx` (desktop), `mobile/HubView.tsx` | ✅ live |
| First target tap | `Tapped visible target` | `targetId`, `title`, `kind`, `source: 'tonight' \| 'mobile_hub'` | `TonightView.tsx`, `mobile/HubView.tsx` | ✅ live |
| Equipment answer | `Answered equipment prompt` | `choice`, `source` | `TonightView.tsx`, `mobile/HubView.tsx` | ✅ live |
| Equipment skip | `Skipped equipment prompt` | `source` | `TonightView.tsx`, `mobile/HubView.tsx` | ✅ live |
| Plan generation | `Generated tonight plan` | `rating`, `targetCount`, `city` | `TonightView.tsx` | ✅ live (added this session) |
| Reminder request | `Added get ready reminder` | `target`, `hasPermission`, `source: 'desktop_planner' \| 'mobile_plan' \| 'mobile_events'` | `DeepSkyPlannerView.tsx`, `mobile/PlanView.tsx`, `mobile/EventsView.tsx` | ✅ live (mobile wired this session) |
| Free plan-add block | `Blocked free plan add` | `action: 'watch' \| 'reminder'`, `source` | `MobileShell.tsx`, `mobile/PlanView.tsx`, `mobile/EventsView.tsx` | ✅ live |
| Signup trigger (shown) | `Signup wall shown` | `reason: 'favourite' \| 'log_observation'` | `SignupWallModal.tsx` | ✅ live |
| Signup trigger (submitted) | `Signup wall submitted` | `reason`, `mode` | `SignupWallModal.tsx` | ✅ live |
| Signup trigger (dismissed) | `Signup wall dismissed` | `reason` | `SignupWallModal.tsx` | ✅ live |
| Merge result | `Merge result` | `source`, `favourites`, `watchlist`, `observations`, `cameraPresets`, `total` | `SignupWallModal.tsx` | ✅ live (added this session) |
| Welcome completion | `Completed welcome beat` | `mergedCount?` | `SignupWelcomeBeat.tsx` | ✅ live |
| Notification sent | `Get-ready notification shown` | `eventId`, `title` | `getReadyReminders.ts` local fallback | ✅ live for local fallback; worker sends push for signed-in subscribers |
| Notification skipped | `Get-ready notification skipped` | `eventId`, `title`, `reason` | `getReadyReminders.ts` local weather gate | ✅ live for local fallback; worker records server-side skipped state |
| Feedback response | `Submitted reminder feedback` | `outcome`, `target`, `kind` | `mobile/PlanView.tsx` | ✅ live |

## Gaps this contract surfaces (not yet closed)

1. **Worker delivery is live for signed-in push subscribers**:
   `addGetReadyReminder` mirrors reminders to `atlas_get_ready_reminders`
   when a push subscription exists, and `scripts/notify.mjs` delivers due
   reminders through service-worker push. Anonymous/offline users still use
   the local in-tab fallback.

## Required properties, by event

Every event above lists its required properties in the table. None of the
live events currently include PII beyond a city name (already public,
user-entered) — no email/name is ever passed as an event property (email is
only attached via PostHog's `$set` in `subscribeForUpdates`, a distinct,
already-existing opt-in flow, not part of this funnel).

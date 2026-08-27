---
type: sync-instructions
generated_by: claude-code-remote
generated_at: 2026-07-25
---

# Outbox — sync into Desk

This folder holds epics and stories written up from Liam's handwritten
"Atlas user flow" notes (2 photographed notebook pages, saved into this
repo at `docs/notes/`) plus the resulting implementation work, done in a
Claude Code on the web session against `signal-k/atlas` on branch
`claude/user-story-implementation-whm03y`.

**Local Claude: when you see this folder after pulling the branch, connect
to the `desk` MCP server (already configured in `.mcp.json`, pointing at
`/Users/scroobz/Documents/Desk/mcp/server.js`) and create/update matching
items in Liam's project management workspace.**

## How to sync

1. Read every `epic-*.md` file first and create one project/epic item per
   file using its frontmatter `title` and the body as the description.
2. Read every `story-*.md` file and create one task/story per file, nested
   under the epic named in its `epic` frontmatter field (match by `id`, not
   filename).
3. Use the `status` frontmatter field to set the created item's status:
   - `done` — implemented and merged on `claude/user-story-implementation-whm03y`; file the corresponding PR/branch as a reference on creation if your Desk tool records source links.
   - `done (pre-existing)` — was already implemented before this session; no new code, logged for traceability against the notes.
   - `in-progress` — partially implemented; the body says what's left.
   - `backlog` — not started; still needs design/implementation.
4. Preserve the `priority` field if Desk supports one; otherwise drop it in
   as a label/tag.
5. If an item with the same `id` already exists in Desk (e.g. from a
   previous sync), update it instead of creating a duplicate — treat `id`
   as the stable external key.
6. After syncing, it's fine to leave these files in place (they're the
   source record of what was scoped/shipped in this session) — don't delete
   them as part of the sync.
7. `story-dashboard-widget-limits.md` carries an explicit "if this isn't
   what was meant" caveat — flag it in Desk (e.g. a "needs confirmation"
   tag) since it resolves a notebook fragment that was never confirmed by
   Liam. `story-daily-transit-articles.md` was originally in this bucket
   too but is now a confirmed, real integration — see its "Correction"
   section for what changed.

## Source material

The two source notebook photos (`docs/notes/2026-07-atlas-user-flow-notes-1.jpeg`,
`docs/notes/2026-07-atlas-user-flow-notes-2.jpeg`) described a "corrected
Atlas user flow": a redesigned home/feed screen (greeting, today's
highlights, interests, a week-ahead conditions strip, a simplified sky
map) plus a set of free-vs-paid product rules (event/forecast lookahead
windows, nearby-better-conditions alerts, per-day premium ratings,
location override), event detail subpages, an onboarding overhaul (name,
interests, location, notification preferences), and an events-page
clarity pass. Two fragments were clarified directly by Liam in chat
(premium per-day ratings, paid location change, Daily Transit articles);
one fragment (dashboard widget limits/priority) was never confirmed and
is resolved to the closest existing feature with a caveat — see
story-dashboard-widget-limits.

A later batch of stories (`story-feed-day-grouping-improvements`,
everything under `epic-event-data-expansion`, everything under
`epic-guest-experience`, everything under
`epic-camera-and-photo-guidance`, everything under
`epic-sky-map-standalone-page`, plus the "Follow-up fix" sections
appended to the three onboarding stories) isn't sourced from the
notebook pages at all -- it's from direct bug reports and feature
requests Liam made in a following chat session, after the notebook-driven
work above had already shipped. Logged here the same way regardless of
source, per the standing instruction to keep this folder as the record of
what was scoped/shipped.

## Index

| id | type | title | status |
| --- | --- | --- | --- |
| epic-feed-redesign | epic | Tonight/Feed redesign | done |
| epic-premium-tiering | epic | Premium tiering & smart alerts | done |
| epic-onboarding | epic | Onboarding overhaul | done |
| epic-events-overhaul | epic | Events page overhaul | done |
| story-feed-greeting-header | story | Feed greeting header | done |
| story-feed-today-highlights | story | "You can see" today highlights | done |
| story-feed-interests-summary | story | Interests summary on feed | done |
| story-feed-week-conditions-strip | story | Week conditions strip w/ premium cutoff | done |
| story-feed-simplified-sky-map | story | Simplify default sky map to direction + altitude | done |
| story-dashboard-widget-limits | story | Dashboard: limit and prioritize what appears | done (pre-existing) |
| story-free-tier-lookahead-caps | story | Free tier: 10-day events / 3-day forecast caps | done (pre-existing) |
| story-premium-forecast-window | story | Premium: per-day rating header + extended forecast window | done |
| story-nearby-better-conditions-alert | story | Paid alert: substantially better conditions nearby | done |
| story-paid-location-override | story | Paid: change location from the feed | done |
| story-event-detail-subpage | story | Tap an event to open detail/plan/share subpage | done (pre-existing) |
| story-home-happening-now | story | Home shows what's happening now/upcoming soon | done (pre-existing) |
| story-onboarding-name | story | Onboarding: capture display name | done |
| story-onboarding-interests | story | Onboarding: capture interests | done |
| story-onboarding-location | story | Onboarding: capture location | done (pre-existing) |
| story-onboarding-notifications | story | Onboarding: capture notification preferences | done |
| story-events-page-structure | story | Events page: 100% clear structure pass | done |
| story-events-category-filter | story | Optional category filter at top of events views | done |
| story-daily-transit-articles | story | Ability to see Daily Transit articles from the Atlas app | done |
| story-feed-day-grouping-improvements | story | Clearer day segmentation and no empty days in the events feed | done |
| epic-event-data-expansion | epic | Event data coverage & volume | in-progress |
| story-location-event-coverage-fix | story | Fix zero location-bound events for users far from the curated city list | done |
| story-new-keyless-event-sources | story | Add asteroid close-approach and fireball event sources | done |
| story-satellite-visual-group-pass | story | Widen satellite pass coverage (Hubble, Celestrak visual group, longer windows) | done |
| story-space-weather-donki | story | Solar flare events via NASA DONKI (built, not enabled in production) | blocked |
| epic-guest-experience | epic | Guest experience — lightweight, browser-storage first | done |
| story-guest-account-graduation | story | Reframe the signup prompt as an offer, with a permanent Settings graduation path | done |
| story-reminder-notification-reliability | story | Fix local reminder notifications silently failing on mobile browsers | done |
| epic-camera-and-photo-guidance | epic | Camera preset optimisation and photo guidance | in-progress |
| story-smart-caption-suggestion | story | Suggest a starting observation caption from data Atlas already has | done |
| story-condition-aware-camera-recipes | story | Camera recipes react to tonight's actual conditions | done |
| story-ai-photo-captions | story | AI photo captions for Sky Pass observations (built, not enabled in production) | blocked |
| story-starry-sky-baseline-recipe | story | Camera guidance for an ordinary night with nothing special happening | done |
| epic-sky-map-standalone-page | epic | Sky map as its own page, with search | done |
| story-sky-map-own-page | story | Sky map opens at a real, bookmarkable URL | done |
| story-sky-map-search | story | Text search on the sky map (no API key, works offline) | done |
| epic-ci-test-reliability | epic | CI test reliability fixes | in-progress |
| story-tonight-window-timezone-fallback | story | Fix e2e mocks missing Open-Meteo timezone, truncating the tonight window | done |
| story-entitlement-checkout-fallback-flake | story | Known flake — dynamic Polar checkout fallback tests in entitlement-refresh.spec.ts | backlog |
| epic-journal-and-content | epic | Atlas journal and editorial content | backlog |
| story-journal-rich-entry-editor | story | Rich Journal/Scrapbook entries and archive | backlog |
| story-daily-transit-in-app-feed | story | The Daily Transit feed inside Atlas | backlog |

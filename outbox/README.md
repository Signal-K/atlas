---
type: sync-instructions
generated_by: claude-code-remote
generated_at: 2026-07-25
---

# Outbox — sync into Desk

This folder holds epics and stories written up from Liam's handwritten
"Atlas user flow" notes (2 photographed notebook pages) plus the resulting
implementation work, done in a Claude Code on the web session against
`signal-k/atlas` on branch `claude/user-story-implementation-whm03y`.

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

## Source material

The two source notebook photos described a "corrected Atlas user flow":
a redesigned home/feed screen (greeting, today's highlights, a week-ahead
conditions strip, a simplified sky map) plus a set of free-vs-paid product
rules (event/forecast lookahead windows, nearby-better-conditions alerts,
location override, event detail subpages) and an onboarding overhaul
(name, interests, location, notification preferences).

## Index

| id | type | title | status |
| --- | --- | --- | --- |
| epic-feed-redesign | epic | Tonight/Feed redesign | in-progress |
| epic-premium-tiering | epic | Premium tiering & smart alerts | in-progress |
| epic-onboarding | epic | Onboarding overhaul | in-progress |
| epic-events-overhaul | epic | Events page overhaul | backlog |
| story-feed-greeting-header | story | Feed greeting header | done |
| story-feed-today-highlights | story | "You can see" today highlights | done |
| story-feed-interests-summary | story | Interests summary on feed | backlog |
| story-feed-week-conditions-strip | story | Week conditions strip w/ premium cutoff | done |
| story-feed-simplified-sky-map | story | Simplify default sky map to direction + altitude | backlog |
| story-free-tier-lookahead-caps | story | Free tier: 10-day events / 3-day forecast caps | done (pre-existing) |
| story-premium-forecast-window | story | Premium: extended forecast window + per-day tips | in-progress |
| story-nearby-better-conditions-alert | story | Paid alert: substantially better conditions nearby | done |
| story-paid-location-override | story | Paid: change/preview location from the feed | backlog |
| story-event-detail-subpage | story | Tap an event to open detail/plan/share subpage | done (pre-existing) |
| story-home-happening-now | story | Home shows what's happening now/upcoming soon | done (pre-existing) |
| story-onboarding-name | story | Onboarding: capture display name | done |
| story-onboarding-interests | story | Onboarding: capture interests | backlog |
| story-onboarding-location | story | Onboarding: capture location | done (pre-existing) |
| story-onboarding-notifications | story | Onboarding: capture notification preferences | backlog |
| story-events-page-structure | story | Events page: 100% clear structure pass | backlog |
| story-events-category-filter | story | Optional category filter at top of events views | done |

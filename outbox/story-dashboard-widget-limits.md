---
id: story-dashboard-widget-limits
type: story
epic: epic-feed-redesign
title: "Dashboard: limit and prioritize what appears"
status: done (pre-existing)
priority: low
source: "Notebook page 1, block before 'Onboarding overhaul' (illegible; best-effort resolution)"
---

# Dashboard: limit and prioritize what appears

This resolves the one notebook fragment from page 1 that stayed
genuinely illegible after two clarification passes — something like "...
limits what appears in the dashboard. Plans ... the arrangements,
priority ... When ... show ...". Liam didn't confirm a specific reading
for this one, so rather than guess at new scope, this write-up documents
the closest existing feature and flags the assumption for correction.

## Acceptance criteria

- [x] Users can turn individual dashboard widgets on/off.
- [x] Users can reorder (prioritize) which widgets show first.

## Status

Already implemented pre-session: `src/components/WidgetSettings.tsx`
(enable/disable checkboxes + up/down reorder + drag-reorder), backed by
`src/widgets/registry.ts`, wired into `SettingsView`. If the original note
meant something else — e.g. a per-plan/per-event "arrangement priority"
rather than dashboard widget layout — this story should be reopened with
a corrected description once Liam can make out the original line.

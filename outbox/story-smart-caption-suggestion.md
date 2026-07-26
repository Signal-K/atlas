---
id: story-smart-caption-suggestion
type: story
epic: epic-camera-and-photo-guidance
title: Suggest a starting observation caption from data Atlas already has
status: done
priority: medium
---

# Suggest a starting observation caption from data Atlas already has

**As an** Atlas user logging an observation for a specific target
**I want** a plausible starting caption instead of a blank textbox
**So that** I don't have to write a description from scratch every time,
and I still get to edit or clear it before saving.

No AI/vision call, no network request, free for every user (not just Sky
Pass) -- this is purely a template filled in from conditions Atlas
already computed before the user tapped "Log attempt."

## Acceptance criteria

- [x] When a "Log attempt" draft carries a target, the note field
      prefills with a suggestion built from the target name, its compass
      direction (when known), and tonight's moon/cloud conditions
      (when known).
- [x] Only prefills when the note is empty -- never overwrites something
      the user already typed.
- [x] Tagged "Suggested — edit as needed" until the user actually edits
      it, so it never reads as Atlas claiming to know what the user saw.
- [x] Degrades gracefully when some/all condition data isn't available
      (e.g. logged from a view that doesn't have direction data) --
      still produces a sensible shorter sentence.

## Implementation

`src/lib/observationDraft.ts`: `ObservationDraft` gained optional
`moonIlluminationPct`, `cloudCoverPct`, `directionLabel` fields, threaded
through from the three "Log attempt" call sites that have this data on
hand already (`TonightView`, `HubView`, `PlanView`/`EventsView` via
`EventDetailPanel`'s existing `moonIlluminationPctAt`/advisory lookups --
no new computation, just passing along values already in scope).

`src/lib/observationCaptionSuggestion.ts`: `suggestObservationCaption()`,
a pure string-builder, e.g. "Looked for Jupiter toward SE. Clear sky (8%
cloud), moon 12% lit." -- omits any clause whose underlying data is
missing rather than showing a placeholder value.

`src/views/ScrapbookView.tsx`: prefills `note` from the draft (only if
empty) and shows the "Suggested" tag until the textarea's `onChange`
fires once, at which point it's just the user's own text like normal.

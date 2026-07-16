# Atlas Journal / Scrapbook Design

## Product Intent

The Journal/Scrapbook is Atlas's personal memory layer. It turns sky events, observing plans, weather windows, trips, photos, and missed attempts into a private record the user can revisit over time.

The experience should feel like a practical field notebook crossed with a scrapbook: fast enough to use outside, structured enough to be useful later, and warm enough that old entries feel worth browsing.

## Design Goals

- Make observation capture fast and forgiving.
- Let users save incomplete notes without friction.
- Preserve personal memory before social sharing.
- Connect entries to events, targets, trips, weather, watchlists, and photo challenges.
- Keep the visual treatment tactile without harming readability.
- Work offline by default.

## Core Experience

The user should be able to move through this loop:

1. Discover or plan something worth seeing.
2. Check whether tonight is viable.
3. Observe, attempt, photograph, or miss it.
4. Capture what happened in seconds.
5. Revisit, edit, organize, share, or reflect later.

The scrapbook owns the last two steps, but it should be reachable from every earlier step.

## Entry Points

Users should be able to create a journal entry from:

- **Tonight**: log the recommended event, target, or viewing session.
- **Explore / Calendar**: log against a scheduled sky event.
- **Plan a trip**: log a dark-sky site visit or deep-sky target attempt.
- **Community / Photo Challenges**: submit an entry while keeping it in the personal journal.
- **History / Scrapbook**: create a freeform manual entry.

## Quick Capture

The first capture UI should be compact. It should not feel like a long form.

Required fields should be minimal:

- Date/time, defaulting to now.
- Location, defaulting to the saved observing location.
- Target or event, prefilled when launched from another screen.
- Result: saw it, partially saw it, missed it, clouded out, photographed it.
- Short note.
- Optional photo.

The user should be able to save with only one or two of these fields completed.

## Rich Entry Editing

After quick capture, an entry can become a richer scrapbook page.

Useful fields:

- Title.
- Body notes.
- Photos or sketches.
- Linked event or target.
- Location name and coordinates.
- Weather snapshot.
- Gear used.
- Camera settings or camera recipe.
- Tags.
- Mood or rating.
- Privacy state.

Advanced metadata should sit in collapsible sections so the main page still reads like a journal entry.

## Scrapbook View

The default view is chronological, newest first.

Each card should show:

- Handwritten-style title or first line.
- Date, time, and location.
- Event or target badge.
- Result badge.
- Photo thumbnail when present.
- Short note excerpt.
- Minimal metadata chips.

The existing ruled-paper background, small alternating tilt, and washi-tape treatment are the right visual direction.

## Archive Relationship

History should have two distinct modes:

- **Archive**: objective record of past sky events and observations.
- **Scrapbook**: subjective record of what the user personally saw, tried, missed, photographed, or wrote down.

These should cross-link. Archive events should show whether the user logged them. Scrapbook entries should link back to their event or target.

## Sharing

Journal entries are private by default.

A user can deliberately create a public share card for a single entry. Shared pages should expose only selected information:

- Public title and note.
- Selected photo.
- Date.
- Approximate location by default.
- Event or target name.
- Optional gear/camera details.

Sharing must be reversible.

## Photo Challenges

Photo Challenge submissions should be journal entries with challenge metadata attached, not a separate content type. This lets social participation become part of the user's personal observing history.

## Streaks and Progress

Progress should be derived from journal activity.

Attempts count. Clouded-out nights, missed meteors, and failed photos should still contribute to the user's observing history.

Possible progress summaries:

- Nights observed this month/year.
- First sightings.
- Target categories completed.
- Locations visited.
- Photo challenge participation.
- Personal bests.

These should remain secondary to memory and reflection.

## Watchlist Loop

When a user logs a watchlisted target, Atlas should ask whether to keep, snooze, or remove it. Completed watchlist items should link to the resulting journal entry.

## Weather Snapshot

When an entry is created, Atlas should capture the best available weather and sky-condition data automatically.

The user should be able to annotate or override this snapshot because real conditions may differ from the forecast.

## Offline Behavior

The journal must work offline.

Offline support should include:

- Local creation, editing, and deletion.
- Local photo attachments where storage allows.
- Quiet unsynced state indicators.
- Queued share-state changes.
- Conflict handling that preserves both versions.

The user should never lose a note because connectivity was poor.

## Data Model Sketch

Core entry fields:

- `id`
- `userId`
- `createdAt`
- `updatedAt`
- `observedAt`
- `title`
- `body`
- `result`
- `eventId`
- `targetId`
- `challengeId`
- `locationName`
- `latitude`
- `longitude`
- `locationPrecision`
- `weatherSnapshot`
- `gear`
- `cameraSettings`
- `tags`
- `photoIds`
- `privacy`
- `shareId`
- `syncState`

Precise coordinates should never be exposed publicly unless the user explicitly chooses that.

## Design Principles

- **Fast first, rich later**: capture should take seconds.
- **Incomplete is valid**: a partial note is still useful.
- **Attempts count**: failure is part of observing.
- **Private by default**: sharing is explicit.
- **Personal before social**: community features should not dominate the journal.
- **Tactile but readable**: scrapbook styling should support scanning and long-term use.
- **Connected everywhere**: entries should connect back to the rest of Atlas.

## Future Directions

- Monthly and yearly recaps.
- Printable/exportable observing log.
- Target maps showing what the user has seen.
- "On this night" resurfacing.
- EXIF-based photo import.
- Voice-note capture.
- Sketch mode.
- Group or family observing entries.

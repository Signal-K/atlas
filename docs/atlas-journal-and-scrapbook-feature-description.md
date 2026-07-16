# Atlas Journal and Scrapbook Feature Description

## Intent

The Journal/Scrapbook is the personal memory layer of Atlas. The rest of the app helps someone decide what to see, where to go, and when conditions are good; the Journal is where those moments become theirs. It should feel less like a database of observations and more like a living sky-watching notebook: practical enough to log useful details, warm enough to revisit, and structured enough to become a personal archive over months and years.

This feature should make Atlas feel like a companion rather than just an astronomy utility. A user should be able to open it and remember where they were, what the sky was like, what they saw, who they were with, what photo they took, what gear they used, and whether the night was worth it.

## What It Should Be

The Journal/Scrapbook should be a hybrid between an observing log, a scrapbook, and a lightweight field notebook.

It should support quick, low-friction capture in the moment, because people may be outside, cold, tired, using one hand, or coming back from a short viewing window. It should also support richer editing later, when the user wants to add photos, refine notes, tag targets, or write a more reflective entry.

The tone should be personal and tactile. The existing ruled-paper, slight card tilt, and washi-tape treatment are the right direction. The UI should imply: "these are your nights under the sky," not "these are rows in a table."

## Core User Promise

Atlas should let a user:

1. Notice an event or target worth seeing.
2. Decide whether tonight is viable.
3. Go outside and observe.
4. Capture what happened quickly.
5. Revisit, edit, organize, share, or connect that observation later.

The Journal/Scrapbook is responsible for steps 4 and 5, but it should be connected to every earlier step.

## How It Should Work

### Entry Creation

Users should be able to create an observation from several places:

- **Tonight**: primary "log observation" path after viewing an event, moon phase, planet, ISS pass, meteor shower, or recommended target.
- **Explore / Calendar**: log against a specific scheduled event.
- **Plan a trip**: log a dark-sky trip, location visit, or deep-sky target attempt.
- **Community / Photo Challenges**: submit an entry into a challenge while keeping it in the personal journal.
- **History / Scrapbook**: manually add a freeform entry.

Creation should start with a compact capture sheet, not a long form. The first version should allow:

- Date and time, defaulting to now.
- Location, defaulting to the user's current saved observing location.
- Event or target, prefilled when launched from another screen.
- Visibility result: saw it, partially saw it, missed it, clouded out, photographed it.
- Short note.
- Optional photo attachment.

The user should be able to save with only a note, only a target, or only a result. Atlas should not punish incomplete capture.

### Rich Editing

After saving, an entry can be expanded into a fuller scrapbook page. Rich edit fields should include:

- Title.
- Body notes.
- Photos or sketches.
- Linked sky event or target.
- Location name and coordinates.
- Weather snapshot: cloud cover, seeing, transparency, moon illumination, temperature, wind.
- Gear used: naked eye, binoculars, telescope, camera, lens, phone.
- Camera recipe used or actual camera settings.
- Tags: meteor shower, moon, planet, comet, ISS, deep sky, trip, challenge, family, first sighting.
- Mood or subjective rating.
- Privacy state: private, shared by link, community-visible.

The editing experience should preserve the journal feel. Advanced metadata can be tucked into collapsible sections so the page does not become a tax form.

### Scrapbook Presentation

The default view should be a chronological scrapbook, newest first, using the paper-card visual treatment already defined in the design brief.

Each entry card should show:

- A handwritten-style title or first line.
- Date, time, and location.
- Target/event badge.
- One key result badge.
- Photo thumbnail if present.
- A short note excerpt.
- Small metadata chips only when helpful.

The user should be able to filter by target type, tag, year/month, location, event, challenge, or shared/private status. Search should work across notes, title, tags, target names, and locations.

### Archive Relationship

History has two related but distinct modes:

- **Archive**: the objective record of past sky events and observations available in Atlas.
- **Scrapbook**: the user's subjective record of what they personally did, saw, tried, missed, photographed, or wrote down.

The two should cross-link. A past event in Archive should show whether the user logged it. A Scrapbook entry linked to an event should open the event details. If a user missed an event because of weather, that still belongs in Scrapbook; missed attempts are part of the observing story.

## Related Features

### Share Cards

A journal entry should be shareable as a clean public card without exposing the whole account. Sharing should generate a standalone public page for one entry, using the existing `/p/:id` route model.

Sharing should support:

- A concise public title and note.
- Selected photo.
- Date and approximate location, with precise coordinates hidden by default.
- Event/target name.
- Optional gear/camera details.
- A clear private/shared state in the editor.

Default should be private. Sharing should be deliberate and reversible.

### Photo Challenges

Photo Challenges should use the Journal as their capture system rather than maintaining a separate submission model. A challenge submission is a journal entry with challenge metadata attached.

This means a user can participate socially without losing the observation in their personal history. Challenge entries should remain editable as personal notes even after a challenge ends, while challenge-specific fields can be locked or archived if needed.

### Streaks and Progress

Observation streaks should be generated from journal activity, not manual check-ins. The system should count meaningful entries: observed, attempted, photographed, or clouded out. This prevents the app from treating weather failure as user failure.

Progress features can include:

- Nights observed this month/year.
- First sightings.
- Target categories completed.
- Locations visited.
- Photo challenge participation.
- Personal bests, such as darkest sky or longest observing session.

These should stay secondary. The Journal is about memory first, gamification second.

### Watchlist Feedback Loop

When a user logs a target from their watchlist, Atlas should ask whether to keep, snooze, or remove it. A completed watchlist item should link back to the resulting journal entry.

This makes the watchlist feel alive: planned targets become memories instead of disappearing into a completed state.

### Weather and Conditions Snapshot

When an entry is created, Atlas should capture the best available weather/sky-condition snapshot automatically. This is especially valuable for later pattern recognition: where the user gets good seeing, which forecasts were accurate, and which conditions produced worthwhile nights.

The snapshot should be editable or annotatable, because real conditions may differ from the forecast.

### Offline-First Behavior

The Journal must work offline. A user may be in a field, garden, park, or dark-sky site without reliable signal.

Offline behavior should include:

- Create, edit, and delete local entries.
- Attach photos locally where browser storage allows.
- Queue share-state changes until reconnect.
- Mark unsynced entries clearly but quietly.
- Resolve sync conflicts in favor of preserving both versions rather than overwriting notes.

The user should never lose an observing note because connectivity was bad.

## Data Shape

A journal entry should roughly contain:

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

Precise coordinates should be treated carefully. Public shares should default to approximate location naming unless the user explicitly opts into more detail.

## UX Principles

- **Fast first, rich later**: the capture path should take seconds; richer editing can happen afterward.
- **Incomplete is valid**: a one-line note is still a real observation.
- **Attempts count**: cloudy nights, missed meteors, and failed photos still belong.
- **Personal before social**: sharing and challenges enhance the journal but should not dominate it.
- **Private by default**: public visibility must be explicit.
- **Tactile but usable**: the scrapbook styling should feel warm without reducing readability or making dense histories hard to scan.
- **Connected to the app**: entries should link back to events, targets, trips, weather, watchlists, and challenges.

## Future Ideas

- Monthly or yearly recap pages generated from entries.
- Printable/exportable observing log.
- Constellation or target maps showing what the user has seen.
- "On this night" memory resurfacing.
- Import from EXIF metadata for photo-based entries.
- Voice-note capture for cold or dark observing sessions.
- Sketch mode for lunar/planetary observations.
- Family/group observing entries with multiple participants.

## Success Criteria

The feature is working when users naturally log both successful and unsuccessful nights, return to old entries because they feel worth revisiting, and can move from planning to observing to remembering without feeling like they are switching products.

The Scrapbook should become the emotional center of Atlas: the place where sky events stop being generic astronomy content and become the user's own history.

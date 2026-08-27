---
id: story-journal-rich-entry-editor
type: story
epic: epic-journal-and-content
title: Rich Journal/Scrapbook entries and archive
status: backlog
priority: high
source: "Liam, in product-direction sync: the richer Journal idea is approved as a ticket"
---

# Rich Journal/Scrapbook entries and archive

**As an** Atlas observer
**I want** to turn a quick check-in into a richer, searchable scrapbook entry
**So that** successful observations, failed attempts, photos and official
tour memories remain useful and worth revisiting.

The quick-capture path remains fast and forgiving. Rich metadata is added
after capture or through an edit action; a user should never need to complete
the full form to save a note.

## Acceptance criteria

- [ ] A saved entry can be opened and edited without losing its existing
      offline/local-first behavior.
- [ ] Rich editing supports a title, body note, observed date/time, result
      state (saw it, partial, missed, clouded out, photographed), linked
      event/target, location name, optional approximate-location precision,
      weather/sky-condition snapshot, gear/camera details, tags, and mood or
      rating.
- [ ] An entry can contain one or more photos where storage allows; photo
      upload remains private by default and preserves local media when offline
      or sync fails.
- [ ] Privacy is explicit and reversible: private, shared by link, or
      community-visible. Precise coordinates are never public by default.
- [ ] Journal history supports search and useful filters (target/type,
      tag, date, location, event, official tour/event context, and privacy).
- [ ] Archive and Scrapbook cross-link: a past Atlas event shows whether it
      has an observation, and a linked journal entry can return to the event
      or target detail.
- [ ] Logging a watchlisted target offers keep, snooze, or remove, and the
      resulting entry remains linked to that target.
- [ ] Official-tour metadata can be attached later without making the Atlas
      Journal responsible for booking or attendee operations. The first
      integration shape should support an official event/tour id, event name,
      venue/city, and a portfolio/stamp presentation.
- [ ] Existing CSV export, public share cards, community sharing, streaks and
      city stamps continue to work, with tests covering incomplete entries and
      clouded-out attempts.

## Suggested implementation slices

1. Extend the local and PocketBase observation shape with a migration-safe
   metadata envelope, preserving old records and existing photos.
2. Add an entry detail/edit surface with collapsible advanced metadata and
   quick result controls.
3. Add local search/filtering first, then make the same fields available to
   public share selection and future official-tour portfolio views.
4. Add sync/conflict tests before enabling multi-photo or richer remote media
   writes broadly.

## Non-goals

- Booking, payment, waivers, attendee management, or tour CRM.
- A generic social network or a mandatory public profile.
- Requiring complete metadata before an observation can be saved.

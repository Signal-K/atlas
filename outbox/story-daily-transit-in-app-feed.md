---
id: story-daily-transit-in-app-feed
type: story
epic: epic-journal-and-content
title: The Daily Transit feed inside Atlas
status: backlog
priority: medium
source: "Liam, in product-direction sync: the in-app TDT newsfeed is approved as a ticket"
---

# The Daily Transit feed inside Atlas

**As an** Atlas user
**I want** to browse a small, current feed of The Daily Transit stories in
Atlas
**So that** I can stay connected to astronomy, exploration and the people
around the night sky between observing sessions.

The Daily Transit remains the editorial source of truth and its own product.
Atlas consumes published content for discovery and sends the reader to the
canonical TDT article when they want the full story.

## Acceptance criteria

- [ ] Atlas fetches published TDT stories from the supported public CMS/API
      surface, with a bounded request/cache strategy and a configurable base
      URL.
- [ ] A dedicated in-app feed surface (Community or Explore, to be settled
      in UX) shows latest stories with title, summary/deck, publication date,
      hero image when available, and a category or content label when TDT
      supplies one.
- [ ] Tapping a story opens a clear preview and a canonical “Read on The
      Daily Transit” action; Atlas does not duplicate TDT's authoring or
      markdown CMS.
- [ ] The feed has graceful loading, empty, offline and unavailable states;
      cached headlines remain readable offline where available.
- [ ] Images are lazy-loaded and failure-safe so one broken TDT asset cannot
      break the Atlas feed.
- [ ] Feed impressions, story opens and outbound TDT clicks are instrumented
      without sending note contents, email or other user-entered PII.
- [ ] The landing page and Atlas navigation make the relationship clear:
      TDT is the editorial/media arm, while Atlas remains the observing app.
- [ ] The feed is independent of Atlas's official-tour/event operations and
      does not add booking, CRM or social-publishing responsibilities.

## Notes

An earlier ticket (`story-daily-transit-articles`) covered an article panel
and outbound links in the former Calendar surface. This is a follow-on scope:
an intentional editorial feed in the current Atlas shell, with offline/cache
behavior and analytics. Reuse the existing TDT CMS adapter if it still
matches the production API; do not create a duplicate integration.

## Non-goals

- Editing, scheduling or publishing TDT content from Atlas.
- Building a podcast host/player before the content/discovery loop is proven.
- Turning TDT into an Atlas community feed or event-booking surface.

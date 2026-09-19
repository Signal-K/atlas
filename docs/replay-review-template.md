# Atlas replay weekly review template (ASV-25)

Light ritual: once a week, open the [Atlas sessions playlist](https://us.posthog.com/project/199773/replay/playlists/YrMgecG0),
watch the new non-internal sessions since last review, and jot 3 bullets per
session worth a note (skip sessions with nothing interesting -- this isn't a
transcript, it's triage).

## Per-session note template

```
Session: <replay URL, e.g. https://us.posthog.com/project/199773/replay/<id>>
Date:
- Confusion: <where did the user hesitate, backtrack, or rage-click?>
- Desire: <what did they try to do that Atlas doesn't support (yet)?>
- Bug: <anything broken -- console error, dead click, stuck state?>
```

File notes into Craft (tag them, attach to ASV-25 or the relevant follow-up
ticket) or as a Linear comment on ASV-25 -- don't let them pile up
unattached in a scratch doc.

## Playlist

Atlas sessions (ASV-25): `$entry_current_url` contains `atlas`, test accounts
filtered, last 7 days, ordered by activity score --
https://us.posthog.com/project/199773/replay/playlists/YrMgecG0

## First pass (18 Sep 2026, cycle 1 closeout)

Playlist filter still returns mostly the operator (`liam@skinetics.tech`) plus
guest `/app` sessions with no email — expected after ASV-47 guest hub. No
anonymous tagged-visit recordings yet.

```
Session: https://us.posthog.com/project/199773/replay/01a0a4ff-541e-79c6-8015-c44f3f95975a
Date: 18 Sep 2026 (~77s, Events)
- Confusion: none observed in this pass (operator session)
- Desire: n/a (internal)
- Bug: none in this recording; use as a baseline for Events duration vs Hub
```

```
Session: https://us.posthog.com/project/199773/replay/01a07b42-0e63-7f1e-b954-b8c390b09dca
Date: 18 Sep 2026 (~46s, Tonight)
- Confusion: none observed in this pass (operator session)
- Desire: n/a (internal)
- Bug: none; Tonight duration is shorter than Events — watch for Hub drop-off
  matching the funnel cliff (landing CTA → Hub) in ASV-24
```

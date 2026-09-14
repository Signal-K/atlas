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

# Spacetober shared schema

Atlas and Landnam share one PocketBase. The collections are defined in
`Signal-K/planet-hunters-experiment-1` at
`pocketbase/pb_migrations/1780713200_event_badges.js`. Atlas mirrors that
migration in `pocketbase/migrations/20261019190000_star_sailors_spacetober.js`
and skips creation when the collections already exist.

`earned_at` is unix milliseconds on both collections. Atlas always writes
`source` = `atlas`. Landnam writes `source` = `landnam`.

## `event_badges`

| field | type | Atlas |
| --- | --- | --- |
| `user` | relation | the signed-in user |
| `event_id` | text | see rows below |
| `tier` | select `gold` \| `silver` | silver is the late badge. Display "Silver · late". Gold is never downgraded. |
| `source` | text | `atlas` |
| `earned_at` | number | unix ms of the first earn. Not moved when a later action only raises the tier. |
| `subject_id` | text | which Atlas action. Unique with `user` and `event_id`. |
| `marker` | text | joint flag, or blank |
| `voucher` | text | blank from Atlas |

Unique index: `(user, event_id, subject_id)`.

Rows Atlas writes:

| action | `event_id` | `subject_id` | `tier` | `marker` |
| --- | --- | --- | --- | --- |
| Any photo in the web app during 19 Oct–8 Nov 2026 | `orionids-2026` | `photo` | `gold` | |
| The same photo after 8 Nov 2026 | `orionids-2026` | `photo` | `silver` | |
| Check-in on 22 Oct 2026 local, 02:00 inclusive until noon | `orionids-2026` | `check-in` | `gold` | `after-moonset` |
| Check-in during World Space Week (4–10 Oct) or the Orionids window | `spacetober-2026` | `stamp` | `gold` | |
| Fireballs in the Sky reading plus the quiz or a 10-minute watch, during the window | `fireball-spotter-2026` | `reading-activity` | `gold` | |
| That same reading after the window | `fireball-spotter-2026` | `reading-activity` | `silver` | |
| Any photo on 17 Nov 2026 | `leonids-2026` | `photo` | `gold` | |
| The same photo after 17 Nov 2026 | `leonids-2026` | `photo` | `silver` | |
| Any photo on 13–14 Dec 2026 | `geminids-2026` | `photo` | `gold` | |
| The same photo after 14 Dec 2026 | `geminids-2026` | `photo` | `silver` | |

Dates are inclusive local civil dates. A photo before 19 Oct 2026 writes no Orionids row. A photo before 17 Nov writes no Leonids row, and a photo before 13 Dec writes no Geminids row. One photo can write a row for every shower that has already opened: gold for the live window, silver for each earlier one. Leonids and Geminids do not write a check-in marker, a Spacetober stamp, or a Fireball Spotter row. Their banner and sky overlay appear only inside the gold window. The Leonids and Geminids entries in the meteor catalogue stay the short peak-night observing windows; these presets do not widen them. A check-in alone does not raise mastery.

**Joint badge for Landnam.** Read the row where:

- `event_id` = `orionids-2026`
- `source` = `atlas`
- `subject_id` = `check-in`
- `marker` = `after-moonset`

That marker is a campaign threshold (local 22 Oct 2026, 02:00 until noon), not the computed moonset. Tallinn's moon sets at 02:48 EEST that morning, which is 01:48 CEST. A 02:10 check-in still sets the marker. Atlas never clears `marker`.

Landnam planet finds are different rows: `source` = `landnam`, `marker` = `orionids-found`, `voucher` = `owned`, `subject_id` = the planet id. Atlas does not write those.

## `meteorite_mastery`

One row per user. Unique on `user`.

| field | type | Atlas |
| --- | --- | --- |
| `user` | relation | the signed-in user |
| `level` | number | Orionids `1`, Leonids `2`, Geminids `3`. Never lowered. |
| `source` | text | `atlas` when Atlas creates or raises the row |
| `event_id` | text | the shower that set the current level |
| `earned_at` | number | unix ms of that raise |

Level 1 is granted by the Orionids photo (`subject_id` `photo`) or by finishing the Fireball Spotter reading. A Leonids photo raises the row to 2. A Geminids photo raises it to 3. When the stored `level` is already at least the new level, Atlas leaves `level`, `source`, `event_id`, and `earned_at` unchanged, including a row Landnam wrote. A raise writes the new level together with `source` `atlas`, the granting `event_id`, and that action's `earned_at`.

## Orionids URL

The stable public URL is [https://youratlas.cc/orionids](https://youratlas.cc/orionids). `/orionids` redirects to the guest-open page `/app/orionids`.

Play link back to Landnam:

`https://playlandnam.space/?utm_source=atlas&utm_medium=campaign&utm_campaign=spacetober-orionids&from=atlas-orionids`

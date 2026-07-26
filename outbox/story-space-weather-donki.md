---
id: story-space-weather-donki
type: story
epic: epic-event-data-expansion
title: Solar flare events via NASA DONKI (built, not enabled in production)
status: blocked
priority: low
---

# Solar flare events via NASA DONKI

**As an** Atlas user
**I want** notable solar flare activity in the feed
**So that** there's a real-world signal tying into the existing aurora
forecast (strong flares are the precursor to later geomagnetic storms).

## Why this is blocked, not done

Liam's instruction: anything requiring a registered API key/auth stays
hidden from production for now. NASA's DONKI API needs an `api.nasa.gov`
key (free, instant to register, but still a step someone has to
deliberately take) — unlike every other source in this epic, which are
all keyless.

The plugin is fully implemented and tested against the live API (using
NASA's public `DEMO_KEY` for verification only, not for production use),
but is intentionally **not** wired to run automatically:

- `scripts/sources/space-weather-donki.mjs` throws immediately if
  `NASA_API_KEY` isn't set in the environment.
- `scripts/ingest.mjs` only pushes this plugin onto its `PLUGINS` list
  when `process.env.NASA_API_KEY` is truthy; otherwise it logs a one-line
  "skipping, not an error" note and moves on. A production run today (no
  such secret configured anywhere) behaves exactly as it did before this
  file existed.
- `.github/workflows/ingest.yml` was deliberately left unchanged — no
  `NASA_API_KEY` secret reference was added, so there's nothing to
  accidentally turn on.

## To actually enable this later

1. Register a free key at api.nasa.gov (or use `DEMO_KEY` for light,
   rate-limited testing only — not appropriate for the scheduled
   production ingest).
2. Add it as a `NASA_API_KEY` repository secret.
3. Pass it through in `.github/workflows/ingest.yml`'s `env:` block for
   the ingest step, same pattern as `PB_ADMIN_EMAIL`/`PB_ADMIN_PASSWORD`.

## Implementation (once enabled)

Fetches NASA DONKI's `FLR` (solar flare) endpoint, filtered to M-class
and X-class flares only (C-class and below are common — dozens a month
even at solar minimum — and not distinct enough to surface as an event).
New kind `solar_flare`, global (no lat/lon, like moon phases/aurora),
folded into the existing "Aurora & space weather" category
(`src/lib/eventCategories.ts`) since a strong flare is the actual
precursor to the aurora activity the existing `aurora.mjs` (NOAA Kp
index) plugin already tracks. Wired into labels/kickers/tonight-target
defaults the same way as the other new kinds this epic added.

Verified with `DEMO_KEY` against a real 30-day window: 66 M/X-class
flares (Atlas is being built during an active point in the solar cycle,
so this number will vary a lot with the sun's actual activity).

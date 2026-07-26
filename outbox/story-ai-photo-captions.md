---
id: story-ai-photo-captions
type: story
epic: epic-camera-and-photo-guidance
title: AI photo captions for Sky Pass observations (built, not enabled in production)
status: blocked
priority: low
---

# AI photo captions for Sky Pass observations

**As a** Sky Pass user who attached a photo to an observation
**I want** Atlas to tell me what's actually visible in it
**So that** I know what I'm looking at even when I'm not sure myself.

## Why this is blocked, not done

Same reason as `story-space-weather-donki` in `epic-event-data-expansion`:
this needs a registered API key (`ANTHROPIC_API_KEY`), so per the standing
instruction it's built and testable but deliberately not enabled anywhere
until that key is actually configured.

- `pocketbase/pb_hooks/photo-caption.pb.js` throws immediately if
  `ANTHROPIC_API_KEY` isn't set in the PocketBase environment.
- The client (`src/lib/photoCaption.ts`) treats any failure from that
  endpoint as "feature unavailable" and silently does nothing -- no error
  surfaced to the user, no broken UI.
- No workflow/env file references the secret, so there's nothing to
  accidentally turn on.

## Research: why Claude vision, not a traditional image classifier

A generic image classifier (Google Cloud Vision Labels, AWS Rekognition)
can say "night sky, long exposure, light" but can't reliably say "this is
Jupiter" from pixels alone -- a faint point of light in a phone photo is
often genuinely ambiguous without more context. A vision-capable LLM can
take that same photo *plus* what Atlas already knows (the target the
observer was aiming at, conditions at the time) as part of the prompt,
producing a grounded, specific caption instead of a blind guess. Checked
Anthropic's current vision docs for feasibility: JPEG/PNG/GIF/WebP
supported, 10MB per image via the API, and at Claude Haiku's per-image
token cost a 1000x1000px phone photo runs about $1.30 per 1,000 images
(standard resolution tier) -- cheap enough that this is a UX/product
decision, not really a cost one, at any plausible Sky Pass volume.

## Acceptance criteria

- [x] Endpoint takes a base64-encoded photo plus target/condition
      context, calls Claude's Messages API with both, and returns a
      one-to-two-sentence caption.
- [x] Gated to Sky Pass (`entitled`) accounts server-side, not just
      hidden client-side.
- [x] Caption is persisted onto the `atlas_observations` record
      (`ai_caption` field) and returned to the client for immediate
      display, best-effort (still returns the caption to the client even
      if persisting it fails).
- [x] Fully disabled (not just "hidden") without the API key configured.

## To actually enable this later

1. Register an Anthropic API key.
2. Add it as an `ANTHROPIC_API_KEY` secret wherever PocketBase's own
   environment is configured (not a GitHub Actions secret -- this runs
   inside the PocketBase server process, not CI).
3. Nothing else needs to change; the hook and client already handle the
   rest.

## Implementation

`pocketbase/migrations/20260726220000_atlas_observation_ai_caption.js`
adds the `ai_caption` text field to `atlas_observations`.

`pocketbase/pb_hooks/photo-caption.pb.js`: `POST
/atlas/observations/caption`, `requireAuth`'d, rejects non-entitled
accounts, sends the photo + context to `claude-haiku-4-5-20251001` via
`$http.send()` (same pattern as the existing Polar checkout hook), and
best-effort persists the result onto the named observation record.
Deliberately takes the photo as base64 JSON (not a multipart file
upload) so it only needs the same `readerToString(e.request.body)` +
`JSON.parse` pattern already proven elsewhere in this codebase
(`demo-access.pb.js`, `polar.pb.js`), rather than a separate,
unverified multipart-file JSVM API.

`src/lib/photoCaption.ts`: client helper, converts the photo `Blob` to
base64 and posts it via `pb.send()` -- note `pb.send()` only JSON-encodes
a plain-object body when `Content-Type: application/json` is explicitly
set, so that header is required, not optional.

`src/lib/sync.ts`'s `pushObservation()` now returns the created record's
id (and persists it as `remoteId` on the local entry, fixing a latent gap
where only `shareObservation()` used to populate that field) so the
caption request has something to attach its result to.

`src/views/ScrapbookView.tsx` fires the caption request after a normal
save completes, only when there's a photo and the signed-in user is
entitled; `src/components/ObservationCard.tsx` displays `aiCaption` when
present.

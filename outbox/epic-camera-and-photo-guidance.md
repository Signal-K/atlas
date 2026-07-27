---
id: epic-camera-and-photo-guidance
type: epic
title: Camera preset optimisation and photo guidance
status: in-progress
priority: medium
source: "Liam, in chat: 'deep research into optimising the camera presets, even faking things a bit, and guiding the user with photography... auto labelling as well, for premium users'"
---

# Camera preset optimisation and photo guidance

Research + prototyping pass on making the existing camera recipes feel
smarter and on whether real photo auto-labelling is viable. Landed on a
three-tier approach, cheapest/most-certain first:

1. **Metadata-driven, ships to everyone, no new API**: a starting
   observation caption suggested from data Atlas already computed
   (target, direction, moon/cloud conditions) before "Log attempt" was
   even tapped -- the "fake it" tier from the request. Zero incremental
   cost, works offline, no account needed.
2. **Condition-aware camera recipes, ships to Sky Pass users, no new
   API**: the existing (already Sky Pass-gated) camera recipe panel now
   shows a one-line "Tonight:" tip built from live cloud/moon/altitude
   data, instead of only ever showing the same evergreen field notes
   regardless of tonight's actual sky.
3. **Real AI photo captions, Sky Pass-gated, requires an API key**: a
   genuine vision-model call (Claude, via Anthropic's Messages API) that
   looks at the actual uploaded photo plus the same context data, to
   describe what's really visible. Researched pricing (~$1.30 per 1,000
   images on Haiku at typical phone-photo resolution -- cheap enough
   that "ongoing cost" isn't a real concern at Sky Pass volumes) and
   confirmed vision-capable LLMs are the right tool for this over a
   traditional image classifier specifically because they can take
   Atlas's own context as part of the prompt, grounding the caption
   instead of guessing blind from pixels alone. Built and wired
   end-to-end, but -- same pattern as story-space-weather-donki in
   epic-event-data-expansion -- gated behind `ANTHROPIC_API_KEY` and not
   enabled on any deployment until that key is actually configured.

## Child stories

- story-smart-caption-suggestion
- story-condition-aware-camera-recipes
- story-ai-photo-captions
- story-starry-sky-baseline-recipe

## Status

All four built. The first, second, and fourth are live for every
relevant user tier today (free/Sky Pass/free respectively); the third
(AI photo captions) needs a deliberate `ANTHROPIC_API_KEY` addition
before it does anything in production.

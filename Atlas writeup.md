# Atlas

## Inspiration

I'm the sort of person to have spent thousands on telescopes and other equipment for stargazing, but right now I'm living out of a suitcase. All I have are my eyes and a smartphone. My love of stargazing is still there. How can I make the most of the often minimal tools I have access to to get the most out of the night sky?

## What it does

Atlas helps people answer one simple question: "What can I actually see tonight, from where I am, with the equipment I have?"

It gives users a personalized sky plan based on their location, weather, moonlight, timing, and visible astronomical events. Atlas highlights phone-friendly and naked-eye targets like the Moon, planets, ISS passes, meteor showers, conjunctions, auroras, and bright deep-sky objects. It also provides pointing guidance, best viewing windows, camera tips, reminders, dark-sky planning, and a journal for logging attempts, even when the attempt is just "went outside, clouds won."

## How we built it

We built Atlas as a React, TypeScript, and Vite progressive web app. The app uses `astronomy-engine` for real sky positioning, `satellite.js` for satellite passes, weather and sky-condition scoring for tonight recommendations, and an offline-first IndexedDB layer with Dexie.

PocketBase powers the backend for sky events, user observations, watchlists, demo access, and community features. Scheduled ingestion scripts collect and normalize events like moon phases, meteor showers, ISS passes, conjunctions, auroras, eclipses, planets, and deep-sky targets. The frontend then turns those into a ranked "tonight" plan that is readable for beginners instead of just showing raw astronomical data.

During OpenAI Build Week, GPT-5.6 Sol through Codex was my primary product and engineering collaborator. I used Codex inside the real repository to audit the existing app, research astronomy and mobile-camera constraints, translate design feedback into scoped changes, implement across React, TypeScript, CSS, PocketBase, and Playwright, and verify the result headlessly. GPT-5.6 Sol helped with the harder judgement calls: separating the quiet hub preview from the full planetarium, reducing event-page overload, designing progressive phone-specific camera guidance, and tracing location and timezone feedback from PostHog into concrete fixes. Atlas does not call an LLM at runtime; Codex and GPT-5.6 were used to build and improve the product.

## Challenges we ran into

The hardest part was translating astronomy into useful guidance. A sky map can be technically correct and still not answer the beginner's real question: "Is this worth going outside for?"

We had to balance precision with approachability: weather, moonlight, altitude, timing, light pollution, event type, equipment, and phone-camera feasibility all affect whether something is actually worth recommending. We also had to design for imperfect conditions, because most real stargazing involves clouds, cities, bad timing, and limited gear.

## Accomplishments that we're proud of

We're proud that Atlas feels practical instead of intimidating. It does not assume the user owns a telescope, knows constellations, or understands astronomical jargon.

The product can recommend what to look for tonight, explain why it is worth seeing, show where to point, suggest how to photograph it with a phone, and help the user build a personal observing record. We're also proud of making the app offline-first and installable, because stargazing often happens away from perfect connectivity.

## What we learned

We learned that the biggest barrier to astronomy is often not equipment. It is confidence, timing, and knowing what counts as a successful first experience.

We also learned that "failed" observing sessions matter. A cloudy night, a missed meteor, or a blurry Moon photo can still be part of building the habit. Atlas became less about perfect astrophotography and more about helping people look up more often.

## What's next for Atlas

Next, we want to make Atlas more personalized and more social. That includes better phone-specific camera recipes, richer dark-sky trip planning, smarter notifications, photo challenges, community presets, and a stronger observing journal.

Longer term, Atlas can become the beginner layer for astronomy: the app people open when they want to know what is visible tonight, how to find it, how to capture it, and how to remember it.

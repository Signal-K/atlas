# Atlas interface — ASV-150

## Visual reference

The three plate.to screenshots supplied by the author on 6 November 2026 are the visual reference: a narrow icon rail, a generously spaced document view, grouped checklist rows, and a collection index of soft grey square tiles. Preserve Atlas's starfield background around the content. Do not restore the previous dashboard kit. Plate supplies the spacing and content hierarchy; do not copy its logo.

## Structure

- A fixed 224px navigation rail with an Atlas text wordmark. Icons have visible destination labels: Feed, Journal, Skills tree, History, and Settings. On phones it narrows to 58px; accessible names remain.
- A transparent document area over a continuous full-viewport starfield. Neither the navigation nor the main area has an opaque background. Feed, calendar, journal, and account share its reading width. Collections use a wider three-column grid.
- Large plain headings, a single fine rule, short introductory text, then content. No marketing hero, coloured status panels, gradients, nebula washes, glass effects, or decorative dashboard cards.
- Feed entries have a title, description, viewing details, and an explicit Add to calendar action. Never present sky events as tickable tasks. Calendar saving remains available within the feed, without a sidebar destination.
- Category browsing remains reachable from the feed rather than a separate sidebar entry.
- Journal uses plain entries with a date, title, and note. Its compose dialog saves to the existing local-first observation store. History groups those observations into a chronological archive. Skills tree derives progress from existing journal evidence and Atlas training rules. Settings holds account and location controls. Add further capabilities incrementally.

## Typography and colour

Arial/Helvetica/system sans-serif. Main title 40px, section headings 23px, list rows 16px. Off-white text, neutral grey metadata, subtle light rules. Collection tiles use a faint translucent neutral fill. The monochrome starfield on #0a0a0a spans the whole page without white panels or black cutouts. No coloured accents.

## Spacing

Desktop document starts 112px from the top. Internal gutters are 48px; sections have 42px separation. Rail buttons are 44×40px. Tiles use 22px internal padding and 28px grid gaps.

## Responsive behaviour

Keep the same visual language on smaller screens. Narrow the rail to 58px, use 22px document gutters, and stack tiles into one column. Avoid a separate mobile dashboard or a second design system.

## Implementation boundary

The old App/AppShell presentation, legacy pages, and original stylesheets are replaced. Existing astronomical calculations, local storage, synchronization, authentication, and event data remain the underlying services. Do not use fixture data in production screens.

The previous journal-only design document is preserved at docs/archive/journal-design-before-asv150.md.

## Feed briefing and navigation

The sidebar collapses to icons and remembers its state. Destination labels and icons have distinct muted colours. Preserve the continuous starfield when switching or collapsing views.

Model the main feed on ios/App/Tonight/TonightView.swift: an observing verdict, sky targets, night timings, and upcoming events. Expose the existing web data values directly: cloud and rain percentages, moon illumination, the computed five-point rating, sunset/darkness/dawn, target best time/direction/altitude, and a seven-night forecast. Attribute weather to Open-Meteo and astronomy to Astronomy Engine.

Naked eye, binoculars, and telescope filters apply consistently to upcoming events and recommended targets. Use KindMeta equipment eligibility; telescope is inclusive of easier equipment. Do not replace missing weather with invented values or describe a weather-dependent score as measured when the source is unavailable. Keep event prose in the detail dialog; the feed shows structured source fields and source images when available.

## Release: daily focus and education

Each day has one calculated observing recommendation, selected for the user's location and equipment from Atlas's daily observing sources. The seven-day picker uses the location's calendar date. Do not imply that calculated visibility predicts cloud cover.

Education begins with dark adaptation, altitude/direction, and low-power telescope setup. A short understanding check records completion locally per account scope. Lesson events report lesson identifiers and correctness, never journal notes or search text. The current analytics include view, equipment, sidebar, event-details, calendar-save, journal-save, daily-focus and education interactions.

Secondary interfaces load in separate chunks. The briefing shares one forecast response with the tonight planner, avoiding duplicate weather requests.

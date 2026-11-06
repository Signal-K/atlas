# Atlas interface — ASV-150

## Visual reference

The three plate.to screenshots supplied by the author on 6 November 2026 are the visual reference: a narrow icon rail, a generously spaced document view, grouped checklist rows, and a collection index of soft grey square tiles. Preserve Atlas's starfield background around the content. Do not restore the previous dashboard kit.

## Structure

- A fixed 88px icon rail, with a small circular mark at the top, primary destinations below, and search/account at the bottom. Names appear on hover and keyboard focus and remain available to assistive technology.
- A restrained white document plane over the starfield. Feed, calendar, journal, and account share its reading width. Collections use a wider three-column grid.
- Large plain headings, a single fine rule, short introductory text, then content. No marketing hero, coloured status panels, gradients, nebula washes, glass effects, or decorative dashboard cards.
- Calendar saving appears as a small checkbox beside each event. Clicking its title opens details. Saved events appear in Calendar.
- Collections are light grey tiles with a bold name at the top and quiet metadata at the bottom. Clicking opens the corresponding filtered feed.
- Journal uses plain entries with a date, title, and note. Its compose dialog saves to the existing local-first observation store.

## Typography and colour

Arial/Helvetica/system sans-serif. Main title 40px, section headings 23px, list rows 16px. Near-black text, neutral grey metadata, fine light-grey rules. Flat white content surfaces and #f5f5f5 collection tiles. Starfield remains monochrome on #0a0a0a outside the document. No coloured accents.

## Spacing

Desktop document starts 112px from the top. Internal gutters are 48px; sections have 42px separation. Rail buttons are 44×40px. Tiles use 22px internal padding and 28px grid gaps.

## Responsive behaviour

Keep the same visual language on smaller screens. Narrow the rail to 58px, use 22px document gutters, and stack tiles into one column. Avoid a separate mobile dashboard or a second design system.

## Implementation boundary

The old App/AppShell presentation, legacy pages, and original stylesheets are replaced. Existing astronomical calculations, local storage, synchronization, authentication, and event data remain the underlying services. Do not use fixture data in production screens.

The previous journal-only design document is preserved at docs/archive/journal-design-before-asv150.md.

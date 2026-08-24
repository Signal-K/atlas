# Event visibility gating

Atlas previously treated a global event as locally visible whenever it had no
ingest latitude/longitude. That is only a catalogue/occurrence rule. The
viewer still needs to be on the right side of Earth, at the right local time,
with the relevant target above the horizon.

## Research conclusions

- Solar eclipses need local circumstances: the observer must be inside the
  event's local visibility region and the Sun must be above the horizon. A
  global total/partial label is not enough; local obscuration and contact
  times can differ by city.
- Lunar eclipses are available to the nighttime hemisphere, not the whole
  planet at one UTC instant. The Moon must be above the local horizon during
  the eclipse window.
- Meteor showers need darkness and a radiant above the horizon. The radiant's
  declination means the observed rate and usefulness differ by latitude and
  hemisphere.
- Planet events and conjunctions need the target body or bodies above a
  practical altitude threshold. Opposition/elongation copy alone does not
  prove that the target is up when the event timestamp occurs.
- ISS and other satellite passes are already city/coordinate-bound, but the
  pass still needs to occur in darkness. Aurora needs darkness plus a
  latitude/activity gate; the ingest Kp forecast supplies the approximate
  equatorward latitude.
- Deep-sky and night-sky guide events need a local dark window. Weather and
  light pollution remain probability gates rather than hard astronomical
  visibility gates.

The app now applies these gates through `src/lib/eventVisibility.mjs` and
combines them with the existing geographic-radius check in
`src/lib/eventFilters.ts`. The Explore “Standout in a city” tab uses the same
predicate, so it cannot promote an event that is merely happening somewhere.

## City check: 28 August 2026 partial lunar eclipse

The generated event peaks at `2026-08-28T04:12:49Z`. For the four acceptance
cities, the local observer result is:

| City | Observer result |
| --- | --- |
| Zurich | visible |
| Reykjavik | visible |
| Melbourne | not visible: daytime / Moon below horizon |
| Santiago | visible |

So the Melbourne 2pm reading is a real failure of the old global-event UI: the
eclipse is occurring, but it should not be presented as visible there.

## Sources

- NASA, [lunar eclipses are seen from the nighttime side of Earth](https://www.jpl.nasa.gov/edu/resources/teachable-moment/how-to-watch-a-total-lunar-eclipse-and-get-students-observing-the-moon/).
- NASA, [solar eclipse local planning and path of totality](https://science.nasa.gov/feature/solar-eclipse-guide/).
- NASA, [meteor showers require darkness and a visible radiant](https://www.nasa.gov/blogs/watch-the-skies/2010/08/12/will-the-perseid-shower-be-visible-from-insert-your-location/).
- NOAA SWPC, [aurora latitude, darkness, and local timing guidance](https://swpc-drupal.woc.noaa.gov/content/tips-viewing-aurora).

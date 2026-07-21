# Atlas PostHog product analysis — 2026-07-21

## Scope

This review used the connected PostHog project over the previous 30 days. The
project contains events from several Star Sailors products, so Atlas results
were isolated with `youratlas.cc` and Atlas preview hosts wherever host data
was available. Heatmap and session-replay scopes were not available to the
connected token; no visual heatmap claims are inferred from click counts.

## Signals

- `youratlas.cc` recorded 90 key product events from 50 people. Atlas traffic
  is split almost evenly between desktop and mobile at the shared root entry
  point, so location and onboarding fixes need to work in both shells.
- 55 people viewed the measured landing experience; 28 clicked a primary CTA.
  Six people reached measured onboarding/account-start events and six generated
  a tonight plan. Event naming overlaps older and newer implementations, so
  these are directional counts rather than a strict same-session funnel.
- Camera configuration is under-discovered: only two `Opened camera recipe`
  events from one person were recorded, compared with 17 generated plans from
  six people.
- Atlas had one root-page rage click in the host-filtered data. The two captured
  exceptions belonged to another product path, not Atlas.
- The actionable Atlas feature request asked for city disambiguation, correct
  time zones for London sunset data, and a way to return to location search.

## Changes driven by this analysis

1. Location search now returns explicit city, region, and country choices using
   Open-Meteo geocoding, with the curated city list retained as an offline
   fallback.
2. Manual locations persist coordinates and IANA timezone, not only a city
   name.
3. The observing window and displayed dusk, dawn, sunset, and target times now
   use the selected location's timezone.
4. A visible location switch is present in the mobile header and the desktop
   Tonight heading; Settings uses the same searchable picker.
5. New analytics events distinguish opening location controls, selecting a
   suggestion, and changing to either a manual or browser location.

## Next measurement

After deployment, compare `Location switch opened` → `Location changed` and
`Location suggestion selected` → `Generated tonight plan`, broken down by
device type. Add `heatmap:read` and `session_recording:read` scopes before the
next UX review so click concentration and abandoned interactions can be
verified visually.

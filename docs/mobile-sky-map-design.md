# Mobile Sky Map Design

Atlas needs two sky-map experiences, not one component resized into different
places.

## References

### Star Walk / Sky Map

Use for the **full-screen map** interaction model:

- The map is the primary experience, not a dashboard widget.
- It identifies real objects from the user's location and time.
- Device orientation / AR is a mode, not always-on decoration.
- Object labels are selective and selection-driven.
- Tapping an object opens more information.
- Visible-tonight lists support the map.

### Master of Orion: Conquer the Stars

Use for the **Hub preview** visual language:

- Wide galaxy field, not circular radar.
- Luminous star-system nodes.
- Thin starlane / route connections.
- One selected/target system can be highlighted.
- Sparse labels.
- Floating panels over space, not card-inside-card map chrome.
- Deep blue/black nebula field with amber/cyan/red accents.

## Hard Rules

- No green wash, green texture, or green dominant glow.
- Green is allowed only for small status LEDs/indicators.
- The Hub preview must not use the planetarium projection.
- The full map must not be embedded inside the Hub card.
- Labels are never global by default. Labels are for:
  - selected target,
  - major bright objects,
  - object detail state.
- Lat/lon is debug telemetry, not primary user-facing content.

## Product Shape

### Hub Preview

Purpose: "Something interesting is happening tonight; tap to explore."

It should show:

- A wide cinematic starfield.
- Real sky objects transformed into a composed strategic layout.
- One target lock if tonight has a target.
- Thin starlane connections between 4-7 prominent objects.
- 2-4 tiny telemetry chips maximum.
- No circular horizon ring.
- No cardinal letters.
- No object-name clutter.

This is a composed **atlas preview**, not a literal sky projection.

### Full Sky Map

Purpose: "Where is this object in my real sky?"

It should show:

- Real local alt/az projection.
- Stars, planets, Moon, deep-sky targets.
- Target marker.
- Compass/device-pointing reticle only when enabled.
- Sparse labels.
- Bottom object/event sheet.
- Layer controls later.

This is the **planetarium map**.

### Event Guidance Mode

Purpose: "Tell me where to point."

Opened from an event or selected Hub target:

- Target selected by default.
- Shows compass direction, altitude, and turn instruction.
- If compass is disabled, shows a clear enable affordance.
- If target is below horizon, says so instead of drawing fake guidance.

## Component Architecture

- `AtlasMapPreview`
  - Hub-only.
  - Uses `getSkyMapObjects`.
  - Strategic layout, starlanes, target lock.
  - No canvas required unless performance demands it later.

- `SkyMapCanvas`
  - Full-screen planetarium only.
  - Real alt/az projection.
  - Draws selected target, labels, reticle.

- `SkyMapOverlay`
  - Full-screen shell.
  - Owns header, close button, footer telemetry, selected object sheet.
  - Hosts `SkyMapCanvas`.

- `skyMapLayers`
  - Shared real object computation.
  - Must remain presentation-agnostic.

## Visual Palette

- Background: `#01040d`, `#020617`, `#07152f`.
- Space glow: deep blue, indigo, faint cyan.
- Stars: bone/off-white.
- Planets: cyan/blue.
- Target route/lock: amber.
- Warning/active reticle: red-orange.
- Text: off-white and muted lavender-blue.

Avoid:

- grey glass dominance,
- green gradients,
- radar rings in the Hub,
- graph-paper texture,
- dense labels,
- tiny centered charts in wide panels.

## Next Implementation Slice

1. Keep `AtlasMapPreview` as the Hub map.
2. Extract full-screen overlay into `SkyMapOverlay`.
3. Add a selected target/object sheet to the overlay.
4. Keep the Hub preview visually dense enough to fill vertical space, but
   semantically minimal.
5. Verify with screenshots at mobile width before further refinement.

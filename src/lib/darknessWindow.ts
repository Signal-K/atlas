// Sun-altitude crossings for a location's night. Kept in its own module,
// free of Dexie/PocketBase imports, so it can be exercised directly from a
// plain Node test without pulling the whole app data layer in.
import * as Astronomy from 'astronomy-engine'

export interface DarknessWindow {
  sunsetAt: string | null
  civilDuskAt: string | null
  astronomicalDuskAt: string | null
  astronomicalDawnAt: string | null
  civilDawnAt: string | null
}

// Sunset (-0.833°, the standard refraction- and solar-radius-corrected
// horizon) plus civil (-6°) and astronomical (-18°) dusk/dawn tonight, used
// both as a TonightScore-adjacent signal and to tell camera-recipe features
// when it's twilight vs. genuinely dark. Sunset is its own crossing because
// it is what people actually recognise as "sunset" -- at London's latitude in
// midsummer civil dusk trails it by over 40 minutes. Returns nulls near the
// poles in summer, where the Sun may never reach these altitudes -- callers
// should treat that as "no confirmed twilight/darkness boundary."
export function getDarknessWindow(lat: number, lon: number, start: Date, end: Date): DarknessWindow {
  const observer = new Astronomy.Observer(lat, lon, 0)
  // `end` is "6am tomorrow" in the *browser's* local timezone (see
  // tonightWindow), which can be well under 24h away. That's too short a
  // span to reliably contain a distant city's own dusk/dawn crossing when
  // the browser and target location sit in very different timezones (e.g.
  // a US-timezone browser viewing Tokyo or Melbourne) -- the search would
  // come up empty and every affected tile would render as "--". Always
  // search at least a full 2 days so the location's own evening is covered
  // regardless of the viewer's timezone.
  const limitDays = Math.max(2, (end.getTime() - start.getTime()) / 86_400_000)
  const search = (direction: number, altitude: number) => {
    const result = Astronomy.SearchAltitude(Astronomy.Body.Sun, observer, direction, start, limitDays, altitude)
    return result ? result.date.toISOString() : null
  }
  return {
    sunsetAt: search(-1, -0.833),
    civilDuskAt: search(-1, -6),
    astronomicalDuskAt: search(-1, -18),
    astronomicalDawnAt: search(1, -18),
    civilDawnAt: search(1, -6),
  }
}

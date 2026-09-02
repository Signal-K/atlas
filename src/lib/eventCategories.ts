// Single source of truth for how sky-event kinds group into browsing
// categories on mobile. Both EventsView and PlanView render through
// SkyEventBrowser against this list -- it must not be redefined per view.
export interface EventCategory {
  id: string
  label: string
  icon: string
  kinds: string[]
}

// Each bucket groups kinds a user would actually recognize as "the same kind
// of thing" -- no catch-all "timed events" bucket mixing an eclipse with a
// comet. "Guides" is deliberately separate from every real dated event: it
// holds the recurring "check an external source" pointer cards (comet
// tracker, generic night-sky guides), which SkyEventBrowser/EntryDetailView
// tag visibly so they never again read as a real scheduled event (the
// "visible planets this month" bug this replaces).
export const EVENT_CATEGORIES: EventCategory[] = [
  { id: 'moon-eclipses', label: 'Moon & eclipses', icon: 'moon', kinds: ['moon_phase', 'eclipse'] },
  { id: 'planets', label: 'Planets & conjunctions', icon: 'orbit', kinds: ['planet_event', 'conjunction'] },
  { id: 'meteor-showers', label: 'Meteors & fireballs', icon: 'zap', kinds: ['meteor_shower', 'fireball'] },
  { id: 'satellites', label: 'Satellites', icon: 'satellite', kinds: ['iss_pass', 'satellite_flare'] },
  { id: 'aurora', label: 'Aurora & space weather', icon: 'aurora', kinds: ['aurora', 'solar_flare'] },
  { id: 'deep-sky', label: 'Deep sky', icon: 'telescope', kinds: ['deep_sky'] },
  { id: 'asteroids', label: 'Asteroids', icon: 'asteroid', kinds: ['asteroid_approach'] },
  { id: 'guides', label: 'Guides', icon: 'book', kinds: ['comet', 'night_sky_guide', 'local_night_sky'] },
]

export const GUIDE_KIND_IDS = new Set(['comet', 'night_sky_guide', 'local_night_sky'])

export function categoryForKind(kind: string): EventCategory | undefined {
  return EVENT_CATEGORIES.find((category) => category.kinds.includes(kind))
}

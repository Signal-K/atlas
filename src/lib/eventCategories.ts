// Single source of truth for how sky-event kinds group into browsing
// categories on mobile. Both EventsView and PlanView render through
// SkyEventBrowser against this list -- it must not be redefined per view.
export interface EventCategory {
  id: string
  label: string
  icon: string
  kinds: string[]
  /** Per-category accent so the grid reads as color-coded sections, not one flat blue. */
  accent: string
}

// Accents match the Daily Transit design language's category palette exactly
// (Atlas Events Feed - Design Language.dc.html): rust/glacier/moss/plum/amber,
// one hue per kind, reserved for kickers/dots/icons only.
export const EVENT_CATEGORIES: EventCategory[] = [
  { id: 'timed', label: 'Timed events', icon: 'zap', kinds: ['eclipse', 'meteor_shower', 'aurora', 'comet'], accent: '#d76131' },
  { id: 'solar-system', label: 'Solar system', icon: 'orbit', kinds: ['moon_phase', 'planet_event', 'conjunction'], accent: '#0a82b3' },
  { id: 'orbit-passes', label: 'Orbit passes', icon: 'satellite', kinds: ['iss_pass', 'satellite_flare'], accent: '#5e944a' },
  { id: 'deep-sky', label: 'Deep sky', icon: 'telescope', kinds: ['deep_sky'], accent: '#8a4ea1' },
  { id: 'sky-guides', label: 'Sky guides', icon: 'book', kinds: ['night_sky_guide', 'local_night_sky'], accent: '#b07700' },
]

export function categoryForKind(kind: string): EventCategory | undefined {
  return EVENT_CATEGORIES.find((category) => category.kinds.includes(kind))
}

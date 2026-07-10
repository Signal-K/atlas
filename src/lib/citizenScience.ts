export interface CitizenScienceOpportunity {
  id: string
  title: string
  description: string
  url: string
  // Sky-event kinds/targets this opportunity is relevant to, matched
  // case-insensitively against upcoming sky_events.
  relevantTo: string[]
}

// A small, static, hand-picked list rather than a live-fetched integration:
// per the Atlas brief's open question, this is the "lighter Atlas-specific
// version" rather than reusing Saily's citizen-science pipeline (which was
// found to be non-functional — scripts/lib/science-feed-runtime.mjs's
// upsertRows() unconditionally throws, so there's nothing there to reuse).
export const CITIZEN_SCIENCE_OPPORTUNITIES: CitizenScienceOpportunity[] = [
  {
    id: 'active-asteroids',
    title: 'Active Asteroids',
    description: 'Help identify comet-like activity (tails, comae) in asteroid images from Zooniverse/NASA data.',
    url: 'https://www.zooniverse.org/projects/orionnau/active-asteroids',
    relevantTo: ['moon_phase'],
  },
  {
    id: 'rubin-comet-catchers',
    title: 'Rubin Comet Catchers',
    description: 'Review Vera Rubin Observatory imagery for comet-like small-body activity.',
    url: 'https://www.zooniverse.org/projects/orionnau/rubin-comet-catchers',
    relevantTo: ['eclipse'],
  },
  {
    id: 'planet-hunters-tess',
    title: 'Planet Hunters TESS',
    description: 'Spot transiting exoplanets in TESS light curves that automated pipelines missed.',
    url: 'https://www.zooniverse.org/projects/nora-dot-eisner/planet-hunters-tess',
    relevantTo: ['planet_event'],
  },
  {
    id: 'backyard-worlds',
    title: 'Backyard Worlds: Planet 9',
    description: 'Search WISE telescope images for brown dwarfs and a possible undiscovered planet in our solar system.',
    url: 'https://www.zooniverse.org/projects/marckuchner/backyard-worlds-planet-9',
    relevantTo: ['deep_sky'],
  },
  {
    id: 'globe-at-night',
    title: 'Globe at Night',
    description: 'Report how many stars you can see tonight to help track light pollution worldwide.',
    url: 'https://globeatnight.org/',
    relevantTo: ['iss_pass', 'meteor_shower'],
  },
]

export function opportunitiesFor(kinds: string[]): CitizenScienceOpportunity[] {
  const kindSet = new Set(kinds.map((kind) => kind.toLowerCase()))
  const matching = CITIZEN_SCIENCE_OPPORTUNITIES.filter((opportunity) =>
    opportunity.relevantTo.some((tag) => kindSet.has(tag.toLowerCase())),
  )
  return matching.length > 0 ? matching : CITIZEN_SCIENCE_OPPORTUNITIES
}

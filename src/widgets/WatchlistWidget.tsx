// EVENT_KINDS/FEATURED_TARGETS are shared with WatchView, which is the live
// implementation of this feature (see WatchView.tsx).
export const EVENT_KINDS = [
  { value: 'moon_phase', label: 'Moon phases' },
  { value: 'meteor_shower', label: 'Meteor showers' },
  { value: 'eclipse', label: 'Eclipses' },
  { value: 'iss_pass', label: 'ISS passes' },
  { value: 'planet_event', label: 'Planet events' },
  { value: 'deep_sky', label: 'Deep-sky objects' },
  { value: 'conjunction', label: 'Conjunctions' },
  { value: 'satellite_flare', label: 'Satellite flares' },
  { value: 'aurora', label: 'Aurora' },
  { value: 'comet', label: 'Comets' },
  { value: 'night_sky_guide', label: 'Night-sky guides' },
  { value: 'local_night_sky', label: 'Local guides' },
]

export const FEATURED_TARGETS = ['moon', 'jupiter', 'mars', 'saturn', 'venus', 'geminids', 'leonids', 'orionids', 'perseids', 'lyrids', 'm31', 'm42']

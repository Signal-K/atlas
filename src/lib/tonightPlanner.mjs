// Beginner planner helpers (ASV-131): gear options, go/no-go verdict and a
// short how-to per target. Pure and dependency-free so it is unit tested
// directly with node --test.
export const PLANNER_GEARS = [
  { id: 'phone', label: 'Phone' },
  { id: 'phone-scope', label: 'Phone + scope' },
  { id: 'smart-scope', label: 'Seestar / Dwarf' },
]

export function goNoGo(rating, cloudCoverPct, moonIlluminationPct) {
  const cloud = Number.isFinite(cloudCoverPct) ? cloudCoverPct : null
  if (rating === 'poor' || rating === 'skip' || (cloud !== null && cloud >= 80)) {
    return { verdict: 'no-go', label: 'No-go tonight', reason: cloud !== null ? `About ${Math.round(cloud)}% cloud means little will be visible. Check the forecast for a clearer night.` : 'Conditions look poor tonight. Check the forecast for a clearer night.' }
  }
  const bright = Number.isFinite(moonIlluminationPct) && moonIlluminationPct >= 70
  if (rating === 'maybe' || (cloud !== null && cloud >= 50)) {
    return { verdict: 'maybe', label: 'Go if the sky opens up', reason: 'Partly cloudy. Try bright targets such as the Moon and planets first.' }
  }
  return { verdict: 'go', label: 'Go tonight', reason: bright ? 'Clear sky, but a bright Moon washes out faint objects. Favour the Moon and planets.' : 'Clear enough for a good session.' }
}

const GROUPS = {
  moon: ['moon_phase', 'eclipse'],
  planet: ['planet_event', 'conjunction', 'bright_star'],
  deepsky: ['deep_sky', 'telescope_target', 'comet', 'asteroid_approach'],
  trails: ['meteor_shower', 'aurora', 'fireball'],
  satellite: ['iss_pass', 'satellite_flare'],
}

export function howToFor(kind, gear) {
  const group = Object.keys(GROUPS).find(key => GROUPS[key].includes(kind)) ?? 'sky'
  const smart = gear === 'smart-scope'
  const scope = gear === 'phone-scope'
  const text = {
    moon: smart ? 'Use the Seestar or Dwarf in lunar mode, keep exposure short and let it track.' : scope ? 'Hold the phone lens to the eyepiece, tap to focus on the edge, set exposure low.' : 'Use the phone camera on a tripod or a steady surface, tap the Moon and drag exposure down.',
    planet: smart ? 'Pick the planet in the app, start a short-exposure stack and let it run a few minutes.' : scope ? 'Use a low-power eyepiece, centre the planet, then shoot a short video through the eyepiece.' : 'Planets show as bright dots. Use Night mode on a tripod; expect a dot, not detail.',
    deepsky: smart ? 'Use deep sky mode, go-to the object, stack for 10 to 20 minutes from a dark spot.' : scope ? 'A phone at the eyepiece rarely catches faint objects. Use the scope to look by eye.' : 'A phone shows little. Use Night mode on a tripod for 10 to 30 seconds, away from city light.',
    trails: smart ? 'Skip tracking for this one. Use a phone on a tripod instead.' : 'Put the phone on a tripod, use Night mode or 15 to 30 second exposures, and shoot many frames.',
    satellite: 'Find the start direction and time, mount the phone on a tripod and use a 10 to 30 second exposure.',
    sky: 'Look up away from lights, let your eyes adapt for 15 minutes and use Night mode on a tripod.',
  }[group]
  return { text, tripod: !(smart || (scope && group !== 'trails')), timing: group === 'moon' || group === 'planet' ? 'Any time it is above the horizon.' : 'Wait until fully dark.' }
}

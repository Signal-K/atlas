// ASV-87 fallback: when an entry has no cached sky-event row and no camera
// recipe, its free-text target name is the only hint to what kind of sighting
// it was. Deliberately conservative -- a miss just means no typed bonus, a
// wrong guess would award one that was not earned. Pure: no imports, so
// node --test can load it.

const PLANETS = /\b(mercury|venus|mars|jupiter|saturn|uranus|neptune)\b/i

const RULES: Array<[RegExp, string]> = [
  [/\bconjunction\b/i, 'conjunction'],
  [/\b(eclipse)\b/i, 'eclipse'],
  [/\b(moon|lunar)\b/i, 'moon_phase'],
  [/\b(iss|space station)\b/i, 'iss_pass'],
  [/\b(meteor|perseid|geminid|leonid|quadrantid|lyrid|orionid|shower)s?\b/i, 'meteor_shower'],
  [/\b(nebula|galaxy|cluster|messier|m\d{1,3}|andromeda|pleiades)\b/i, 'deep_sky'],
]

export function kindFromTargetName(targetName: string | undefined): string | undefined {
  const name = targetName?.trim()
  if (!name) return undefined
  for (const [pattern, kind] of RULES) if (pattern.test(name)) return kind
  if (PLANETS.test(name)) return 'planet_event'
  return undefined
}

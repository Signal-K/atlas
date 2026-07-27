import type { SkyMapObject } from './skyMapLayers'

// Lightweight natural-language-ish search for the sky map: no LLM call, no
// API key, works offline -- matches free text against the objects Atlas
// already knows are visible right now (name, kind, constellation, rough
// compass direction). Handles the phrasing people actually type ("where's
// jupiter", "show me the moon", "what's in the north", "brightest star")
// well enough to be useful, without pretending to be a real language model.
const FILLER_PATTERN = /\b(where'?s|where is|show me|find|look for|point at|point me at|what'?s|whats|the|a|an|in|to)\b/gi

const DIRECTION_WORDS: Record<string, string> = {
  north: 'N',
  south: 'S',
  east: 'E',
  west: 'W',
  northeast: 'NE',
  northwest: 'NW',
  southeast: 'SE',
  southwest: 'SW',
}

const CATEGORY_WORDS: Partial<Record<SkyMapObject['kind'], string[]>> = {
  planet: ['planet', 'planets'],
  star: ['star', 'stars'],
  moon: ['moon'],
  deep_sky: ['nebula', 'galaxy', 'cluster', 'deep sky', 'deep-sky'],
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(FILLER_PATTERN, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function brightestFirst(objects: SkyMapObject[]): SkyMapObject[] {
  return [...objects].sort((a, b) => (a.magnitude ?? 5) - (b.magnitude ?? 5))
}

// Returns the best-matching visible object for a free-text query, or null
// if nothing reasonable matches. `objects` should already be filtered to
// what's actually visible (callers pass allVisibleObjects).
export function findSkyMapObjectFromQuery(query: string, objects: SkyMapObject[]): SkyMapObject | null {
  const normalized = normalize(query)
  if (!normalized) return null

  // 1. Direct name match -- longest matching name wins, so "jupiter" beats
  // a coincidental partial match on something else.
  const nameMatches = objects
    .filter((object) => normalized.includes(object.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length)
  if (nameMatches[0]) return nameMatches[0]

  // 2. Constellation match ("what's in orion").
  const constellationMatches = objects.filter(
    (object) => object.constellation && normalized.includes(object.constellation.toLowerCase()),
  )
  if (constellationMatches[0]) return brightestFirst(constellationMatches)[0]

  // 3. Category word ("brightest star", "any planets").
  for (const [kind, words] of Object.entries(CATEGORY_WORDS)) {
    if (words.some((word) => normalized.includes(word))) {
      const ofKind = objects.filter((object) => object.kind === kind)
      if (ofKind[0]) return brightestFirst(ofKind)[0]
    }
  }

  // 4. Direction word ("what's in the north") -- picks the brightest
  // object whose compass label starts with the requested direction, so
  // "north" also matches "NNE"/"NNW" rather than requiring an exact label.
  // Longest words first so "northeast" matches NE, not the "north"
  // substring it also happens to contain.
  const directionEntries = Object.entries(DIRECTION_WORDS).sort((a, b) => b[0].length - a[0].length)
  for (const [word, abbrev] of directionEntries) {
    if (normalized.includes(word)) {
      const inDirection = objects.filter((object) => object.compassLabel.startsWith(abbrev))
      if (inDirection[0]) return brightestFirst(inDirection)[0]
    }
  }

  return null
}

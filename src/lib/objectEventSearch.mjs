function searchable(value) {
  return String(value ?? '')
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
function eventMatchesObject(event, object) {
  const target = searchable(event.target)
  const objectId = searchable(object.id)
  const objectName = searchable(object.name)
  const eventText = searchable(`${event.title} ${event.description ?? ''} ${event.content ?? ''}`)

  return target === objectId || target === objectName || eventText.includes(objectName)
}

/**
 * Match catalogue objects and attach the next local events already selected
 * for the observer. Keeping this pure makes the ranking and matching rules
 * testable without mounting the search overlay or touching IndexedDB.
 */
export function findObjectEventResults(objects, events, query, options = {}) {
  const needle = searchable(query)
  if (!needle) return []

  const objectLimit = options.objectLimit ?? 8
  const eventLimit = options.eventLimit ?? 3
  const nowMs = options.nowMs ?? Date.now()
  const seen = new Set()

  return objects
    .filter((object) => searchable(`${object.id} ${object.name} ${object.kind ?? ''}`).includes(needle))
    .filter((object) => {
      const key = searchable(object.id || object.name)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, objectLimit)
    .map((object) => ({
      ...object,
      events: events
        .filter((event) => new Date(event.endsAt ?? event.startsAt).getTime() >= nowMs)
        .filter((event) => eventMatchesObject(event, object))
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
        .slice(0, eventLimit),
    }))
}

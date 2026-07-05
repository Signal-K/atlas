import { db } from './db'

// Local-only for now (no auth requirement, works fully offline). Could move
// to a synced PocketBase collection alongside favourites/watchlist (AT-006)
// once that lands.
export async function getPinnedEventIds(): Promise<Set<string>> {
  const all = await db.pinnedEvents.toArray()
  return new Set(all.map((entry) => entry.eventId))
}

export async function togglePin(eventId: string, currentlyPinned: boolean): Promise<void> {
  if (currentlyPinned) {
    await db.pinnedEvents.delete(eventId)
  } else {
    await db.pinnedEvents.put({ eventId, pinnedAt: new Date().toISOString() })
  }
}

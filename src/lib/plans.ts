import { pb } from './pocketbase'
import type { AtlasEvent } from './events'

// "Add to plan" is Sky Pass only (see EventDetailPage), and maps onto the
// existing atlas_favourites/atlas_watchlist collections rather than a new
// per-event-instance table: a favourite is "I care about this target"
// (kind='target', value=event.target, unique per user), and a watchlist row
// is the toggle on top of that favourite. Reusing these means an event's
// target carries forward across its recurring instances (e.g. every future
// ISS pass over the same city) instead of planning a single occurrence.

export interface PlanState {
  planned: boolean
  watchlistId?: string
}

async function findFavourite(userId: string, target: string) {
  try {
    return await pb.collection('atlas_favourites').getFirstListItem(`user = "${userId}" && kind = "target" && value = "${target}"`)
  } catch {
    return null
  }
}

export async function getPlanState(userId: string, event: AtlasEvent): Promise<PlanState> {
  const favourite = await findFavourite(userId, event.target)
  if (!favourite) return { planned: false }

  try {
    const watchlist = await pb.collection('atlas_watchlist').getFirstListItem(`user = "${userId}" && favourite = "${favourite.id}"`)
    return { planned: true, watchlistId: watchlist.id }
  } catch {
    return { planned: false }
  }
}

async function ensureFavourite(userId: string, target: string) {
  const existing = await findFavourite(userId, target)
  if (existing) return existing
  return pb.collection('atlas_favourites').create({ user: userId, kind: 'target', value: target })
}

export async function addToPlan(userId: string, event: AtlasEvent): Promise<string> {
  const favourite = await ensureFavourite(userId, event.target)
  const watchlist = await pb.collection('atlas_watchlist').create({ user: userId, favourite: favourite.id, notify_on_good_viewing: true })
  return watchlist.id
}

export async function removeFromPlan(watchlistId: string): Promise<void> {
  await pb.collection('atlas_watchlist').delete(watchlistId)
}

import { pb } from './pocketbase'
import type { StreakState } from './db'

const OPT_IN_KEY = 'atlas-leaderboard-name'

export interface LeaderboardEntry {
  displayName: string
  currentWeeks: number
  longestWeeks: number
}

export function getOptInName(): string | null {
  return localStorage.getItem(OPT_IN_KEY)
}

// Publishes (or updates) a public row under the user's own chosen display
// name -- not their email/id -- so opting in doesn't leak account identity.
export async function optIn(displayName: string, streak: StreakState): Promise<void> {
  if (!pb.authStore.isValid) throw new Error('Sign in to join the leaderboard.')
  localStorage.setItem(OPT_IN_KEY, displayName)
  await syncLeaderboardEntry(streak, displayName)
}

export async function optOut(): Promise<void> {
  localStorage.removeItem(OPT_IN_KEY)
  if (!pb.authStore.isValid || !navigator.onLine) return
  try {
    const existing = await pb
      .collection('atlas_streak_leaderboard_entries')
      .getFirstListItem(`user = "${pb.authStore.record?.id}"`)
    await pb.collection('atlas_streak_leaderboard_entries').delete(existing.id)
  } catch {
    // Already gone, or offline — nothing further to clean up.
  }
}

// Called after every recordWeeklyActivity() so an opted-in user's public row
// stays current. No-op if the user hasn't opted in.
export async function syncLeaderboardEntry(streak: StreakState, displayNameOverride?: string): Promise<void> {
  const displayName = displayNameOverride ?? getOptInName()
  if (!displayName) return
  if (!pb.authStore.isValid || !navigator.onLine) return

  try {
    const payload = {
      user: pb.authStore.record?.id,
      display_name: displayName,
      current_weeks: streak.currentWeeks,
      longest_weeks: streak.longestWeeks,
    }
    const existing = await pb
      .collection('atlas_streak_leaderboard_entries')
      .getFirstListItem(`user = "${pb.authStore.record?.id}"`)
      .catch(() => null)
    if (existing) await pb.collection('atlas_streak_leaderboard_entries').update(existing.id, payload)
    else await pb.collection('atlas_streak_leaderboard_entries').create(payload)
  } catch {
    // Best-effort — retried on the next weekly-activity tick.
  }
}

export async function listLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  try {
    const records = await pb.collection('atlas_streak_leaderboard_entries').getFullList({ sort: '-current_weeks' })
    return records.slice(0, limit).map((record) => ({
      displayName: record.display_name,
      currentWeeks: record.current_weeks,
      longestWeeks: record.longest_weeks,
    }))
  } catch {
    return []
  }
}

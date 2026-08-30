import { db, type StreakState } from './db'
import { pb } from './pocketbase'
import { syncLeaderboardEntry } from './leaderboard'

const LOCAL_USER_ID = 'local'

function scopeId(): string {
  return pb.authStore.record?.id ?? LOCAL_USER_ID
}

// Monday of the ISO week containing `date`, as YYYY-MM-DD.
function weekStart(date: Date): string {
  const d = new Date(date)
  const day = (d.getDay() + 6) % 7 // 0 = Monday
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

function weeksBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (7 * 86_400_000))
}

export async function getStreak(): Promise<StreakState | undefined> {
  return db.streaks.get(scopeId())
}

// Weekly login OR observation-log activity, whichever happens first, keeps
// the streak alive for that week (the atlas_streaks schema tracks a single
// combined counter, not separate login/observation streaks).
export async function recordWeeklyActivity(now = new Date()): Promise<StreakState> {
  const user = scopeId()
  const currentWeek = weekStart(now)
  const existing = await db.streaks.get(user)

  let next: StreakState
  if (!existing) {
    next = { userId: user, currentWeeks: 1, longestWeeks: 1, lastLoggedWeekStart: currentWeek }
  } else if (existing.lastLoggedWeekStart === currentWeek) {
    next = existing
  } else {
    const gap = weeksBetween(existing.lastLoggedWeekStart, currentWeek)
    const currentWeeks = gap === 1 ? existing.currentWeeks + 1 : 1
    next = {
      userId: user,
      currentWeeks,
      longestWeeks: Math.max(existing.longestWeeks, currentWeeks),
      lastLoggedWeekStart: currentWeek,
    }
  }

  await db.streaks.put(next)

  if (next !== existing && pb.authStore.isValid && navigator.onLine) {
    try {
      const remote = await pb.collection('atlas_streaks').getFirstListItem(`user = "${pb.authStore.record?.id}"`).catch(() => null)
      const payload = {
        user: pb.authStore.record?.id,
        current_weeks: next.currentWeeks,
        longest_weeks: next.longestWeeks,
        last_logged_week_start: next.lastLoggedWeekStart,
      }
      if (remote) {
        await pb.collection('atlas_streaks').update(remote.id, payload)
      } else {
        try {
          await pb.collection('atlas_streaks').create(payload)
        } catch {
          // Lost a create race to another concurrent tab/request -- the
          // unique index on `atlas_streaks.user` rejected our insert, so
          // the row now exists; fetch it and update instead of losing this
          // write entirely.
          const winner = await pb.collection('atlas_streaks').getFirstListItem(`user = "${pb.authStore.record?.id}"`)
          await pb.collection('atlas_streaks').update(winner.id, payload)
        }
      }
    } catch {
      // Offline race or transient failure — local state stands, retried next activity.
    }
  }

  await syncLeaderboardEntry(next)

  return next
}

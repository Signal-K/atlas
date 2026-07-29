import { useEffect, useState } from 'react'
import { recordWeeklyActivity } from '../../lib/streaks'
import { listLeaderboard, type LeaderboardEntry } from '../../lib/leaderboard'
import type { StreakState } from '../../lib/db'
import { HubIcon } from './HubIcon'

// Folded in from the old desktop widget stack (StreakWidget/LeaderboardWidget)
// so the streak/leaderboard content isn't lost now that Today is HubView
// everywhere, not a widget picker. The leaderboard only ever shows if at
// least one person has opted in from Settings -- same effective visibility
// as the old widget's defaultEnabled: false, just decided by whether there's
// anything to show rather than a separate per-viewer toggle.
export function StreakSection() {
  const [streak, setStreak] = useState<StreakState | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    let cancelled = false
    recordWeeklyActivity().then((state) => {
      if (!cancelled) setStreak(state)
    })
    listLeaderboard(5).then((entries) => {
      if (!cancelled) setLeaderboard(entries)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!streak) return null

  return (
    <>
      <div className="dt-stitch" />
      <section>
      <div className="dt-section-eyebrow">
        <HubIcon name="spark" />
        Weekly streak
      </div>
      <div className="dt-widget-grid">
        <div className="dt-widget-cell">
          <span className="dt-widget-eyebrow">Current</span>
          <span className="dt-widget-value">{streak.currentWeeks}</span>
          <span className="dt-widget-caption">week{streak.currentWeeks === 1 ? '' : 's'} in a row</span>
        </div>
        <div className="dt-widget-cell">
          <span className="dt-widget-eyebrow">Best</span>
          <span className="dt-widget-value">{streak.longestWeeks}</span>
          <span className="dt-widget-caption">longest streak</span>
        </div>
      </div>
      <p className="dt-empty-hint">Opening Atlas or logging an observation at least once a week keeps your streak alive.</p>
      {leaderboard.length > 0 && (
        <div className="mobile-mini-list">
          {leaderboard.map((entry, index) => (
            <div className="mobile-mini-row mobile-plan-row mobile-plan-row--status" key={`${entry.displayName}-${index}`}>
              <span className="mobile-event-kind">#{index + 1}</span>
              <span className="mobile-mini-row-name">{entry.displayName}</span>
              <span className="mobile-mini-row-meta">{entry.currentWeeks}w</span>
            </div>
          ))}
        </div>
      )}
      </section>
    </>
  )
}

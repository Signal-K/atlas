import { useEffect, useState } from 'react'
import { registerWidget } from './registry'
import { recordWeeklyActivity } from '../lib/streaks'
import type { StreakState } from '../lib/db'

function StreakWidget() {
  const [streak, setStreak] = useState<StreakState | null>(null)

  useEffect(() => {
    let cancelled = false
    recordWeeklyActivity().then((state) => {
      if (!cancelled) setStreak(state)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (streak === null) return <p>Loading&hellip;</p>

  return (
    <div className="streak-widget">
      <div className="streak-stat">
        <span className="streak-stat-value">{streak.currentWeeks}</span>
        <span className="streak-stat-label">week{streak.currentWeeks === 1 ? '' : 's'} in a row</span>
      </div>
      <div className="streak-stat">
        <span className="streak-stat-value">{streak.longestWeeks}</span>
        <span className="streak-stat-label">longest streak</span>
      </div>
      <p className="scrapbook-hint">Opening Atlas or logging an observation at least once a week keeps your streak alive.</p>
    </div>
  )
}

registerWidget({
  id: 'streak',
  title: 'Weekly streak',
  Component: StreakWidget,
  defaultEnabled: true,
})

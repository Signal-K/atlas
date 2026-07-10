import { useEffect, useState } from 'react'
import { registerWidget } from './registry'
import { listLeaderboard, type LeaderboardEntry } from '../lib/leaderboard'

function LeaderboardWidget() {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null)

  useEffect(() => {
    listLeaderboard().then(setEntries)
  }, [])

  if (entries === null) return <p>Loading&hellip;</p>
  if (entries.length === 0) {
    return <p className="scrapbook-hint">No one's opted in yet — join from Settings to be the first on the board.</p>
  }

  return (
    <ol className="leaderboard-list">
      {entries.map((entry, index) => (
        <li key={entry.displayName + index} className="leaderboard-row">
          <span className="leaderboard-rank">{index + 1}</span>
          <span className="leaderboard-name">{entry.displayName}</span>
          <span className="leaderboard-weeks">{entry.currentWeeks}w</span>
        </li>
      ))}
    </ol>
  )
}

registerWidget({
  id: 'leaderboard',
  title: 'Streak leaderboard',
  Component: LeaderboardWidget,
  defaultEnabled: false,
})

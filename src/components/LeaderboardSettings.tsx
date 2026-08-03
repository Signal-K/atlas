import { useState } from 'react'
import { getOptInName, optIn, optOut } from '../lib/leaderboard'
import { useAuth } from '../lib/auth'
import { recordWeeklyActivity } from '../lib/streaks'

export function LeaderboardSettings() {
  const { user } = useAuth()
  const [displayName, setDisplayName] = useState(() => getOptInName() ?? '')
  const [savedName, setSavedName] = useState(() => getOptInName() ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function handleOptIn(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = displayName.trim()
    if (!trimmed || !user) return
    setBusy(true)
    setMessage('')
    try {
      const streak = await recordWeeklyActivity()
      await optIn(trimmed, streak)
      setSavedName(trimmed)
      setDisplayName(trimmed)
      setMessage('Leaderboard entry published.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update leaderboard.')
    } finally {
      setBusy(false)
    }
  }

  async function handleOptOut() {
    setBusy(true)
    setMessage('')
    try {
      await optOut()
      setSavedName('')
      setMessage('Leaderboard entry removed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="settings-row settings-row--leaderboard">
      <div>
        <span className="settings-label">Public profile</span>
        <p className="settings-help">Publish your weekly streak under a display name. Your account email stays private.</p>
      </div>
      <form className="leaderboard-settings-form" onSubmit={handleOptIn}>
        <input
          type="text"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Display name"
          maxLength={40}
          disabled={!user || busy}
        />
        <div className="leaderboard-settings-actions">
          <button type="submit" disabled={!user || busy || !displayName.trim()}>
            {savedName ? 'Update' : 'Join'}
          </button>
          {savedName && (
            <button type="button" onClick={handleOptOut} disabled={busy}>
              Leave
            </button>
          )}
        </div>
        <p className="settings-help">{user ? message || (savedName ? `Listed as ${savedName}.` : 'Not listed yet.') : 'Sign in above to join.'}</p>
      </form>
    </div>
  )
}

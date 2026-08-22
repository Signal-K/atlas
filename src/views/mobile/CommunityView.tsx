import { useState } from 'react'
import { FeedView } from '../FeedView'
import { PhotoChallengesView } from '../PhotoChallengesView'
import { DigestWidget } from '../../widgets/DigestWidget'
import { LeaderboardWidget } from '../../widgets/LeaderboardWidget'

type CommunityMode = 'digest' | 'feed' | 'challenges' | 'leaderboard'

const MODES: Array<{ id: CommunityMode; label: string }> = [
  { id: 'digest', label: 'Digest' },
  { id: 'feed', label: 'Feed' },
  { id: 'challenges', label: 'Challenges' },
  { id: 'leaderboard', label: 'Board' },
]

export function CommunityView() {
  const [mode, setMode] = useState<CommunityMode>('digest')

  function contentForMode() {
    if (mode === 'feed') return <FeedView />
    if (mode === 'challenges') return <PhotoChallengesView />
    if (mode === 'leaderboard') {
      return <section className="widget-section"><h2>Streak leaderboard</h2><LeaderboardWidget /></section>
    }
    return <section className="widget-section"><h2>This week's top discoveries</h2><DigestWidget onOpenFeed={() => setMode('feed')} /></section>
  }

  return (
    <div className="mobile-community">
      <section className="mobile-card mobile-community-switcher">
        <div className="mobile-card-header">
          <div>
            <div className="mobile-card-eyebrow">Community</div>
            <h2>Shared sky log</h2>
          </div>
        </div>
        <div className="mobile-community-tabs" aria-label="Community sections">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={mode === item.id ? 'is-active' : ''}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>
      <div className="mobile-community-panel">{contentForMode()}</div>
    </div>
  )
}

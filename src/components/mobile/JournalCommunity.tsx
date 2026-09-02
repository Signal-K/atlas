import { useEffect, useState } from 'react'
import { Sheet } from './Sheet'
import { ChallengeSubmitSheet, type ActiveChallenge } from './JournalSheets'
import { DigestWidget } from '../../widgets/DigestWidget'
import { LeaderboardWidget } from '../../widgets/LeaderboardWidget'
import { getUpcomingEvents, pullSkyEvents } from '../../lib/sync'
import { getChallengesForEvent } from '../../lib/photoChallenges'
import { listDiscoveries, REACTIONS, toggleReaction, toggleVote, type Discovery } from '../../lib/discoveries'
import { useAuth } from '../../lib/auth'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function DiscoveryCard({
  discovery,
  onVote,
  onReact,
  canInteract,
}: {
  discovery: Discovery
  onVote: () => void
  onReact: (emoji: string) => void
  canInteract: boolean
}) {
  const gear = [discovery.camera, discovery.telescope, discovery.filters].filter(Boolean).join(' · ')

  return (
    <div className="az-card">
      <div className="az-card-body" style={{ display: 'flex', alignItems: 'center', gap: '0.5625rem', paddingBottom: '0.5rem' }}>
        <span
          style={{
            width: '2rem',
            height: '2rem',
            borderRadius: '50%',
            background: 'var(--chip)',
            display: 'grid',
            placeItems: 'center',
            font: '600 0.6875rem var(--az-font-mono)',
            flex: 'none',
          }}
        >
          {initials(discovery.authorName)}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <strong style={{ display: 'block', fontSize: '0.84375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {discovery.authorName}
          </strong>
          <span className="az-muted" style={{ fontSize: '0.71875rem' }}>
            {new Date(discovery.created).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            {discovery.target ? ` · ${discovery.target}` : ''}
          </span>
        </div>
        <span className="az-pill" style={{ '--pill-hue': discovery.imageUrl ? 200 : 288 } as React.CSSProperties}>
          {discovery.imageUrl ? 'PHOTO' : 'SIGHTING'}
        </span>
      </div>
      {discovery.imageUrl ? (
        <img src={discovery.imageUrl} alt={discovery.caption} loading="lazy" style={{ width: '100%', height: '11rem', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div className="az-hero-media" style={{ height: '5rem' }}>
          NO PHOTO
        </div>
      )}
      <div className="az-card-body">
        <p style={{ margin: '0 0 0.625rem', fontSize: '0.84375rem', lineHeight: 1.5 }}>{discovery.caption}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <button type="button" className={`az-chip${discovery.hasVoted ? ' is-active' : ''}`} onClick={onVote} disabled={!canInteract}>
            ▲ {discovery.voteCount} saved
          </button>
          {gear && (
            <span className="az-muted" style={{ fontSize: '0.71875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {gear}
            </span>
          )}
        </div>
        <div className="az-chip-row" style={{ marginTop: '0.5rem' }}>
          {REACTIONS.map((reaction) => {
            const count = discovery.reactionCounts[reaction.id] ?? 0
            const mine = discovery.myReactions.has(reaction.id)
            return (
              <button
                key={reaction.id}
                type="button"
                className={`az-chip${mine ? ' is-active' : ''}`}
                onClick={() => onReact(reaction.id)}
                disabled={!canInteract}
                title={reaction.label}
              >
                {reaction.glyph}
                {count > 0 ? ` ${count}` : ''}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function JournalCommunity() {
  const { user } = useAuth()
  const [activeChallenges, setActiveChallenges] = useState<ActiveChallenge[] | null>(null)
  const [discoveries, setDiscoveries] = useState<Discovery[] | null>(null)
  const [submitTarget, setSubmitTarget] = useState<ActiveChallenge | null>(null)
  const [digestOpen, setDigestOpen] = useState(false)
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)

  async function refreshChallenges() {
    await pullSkyEvents()
    const upcoming = await getUpcomingEvents(50)
    setActiveChallenges(upcoming.flatMap((event) => getChallengesForEvent(event).map((challenge) => ({ event, challenge }))))
  }

  async function refreshDiscoveries() {
    setDiscoveries(await listDiscoveries())
  }

  useEffect(() => {
    refreshChallenges()
    refreshDiscoveries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleVote(discovery: Discovery) {
    if (!user) return
    await toggleVote(discovery.id, discovery.hasVoted)
    await refreshDiscoveries()
  }

  async function handleReact(discovery: Discovery, emoji: string) {
    if (!user) return
    await toggleReaction(discovery.id, emoji, discovery.myReactions.has(emoji))
    await refreshDiscoveries()
  }

  return (
    <>
      <div className="az-section-head" style={{ marginTop: '1rem' }}>
        <span className="az-kicker">Community</span>
      </div>
      <div className="az-chip-row">
        <button type="button" className="az-chip" onClick={() => setDigestOpen(true)}>
          This week's top picks →
        </button>
        <button type="button" className="az-chip" onClick={() => setLeaderboardOpen(true)}>
          Leaderboard
        </button>
      </div>

      {activeChallenges != null && activeChallenges.length > 0 && (
        <>
          <div className="az-section-head">
            <span className="az-kicker">Photo challenge</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {activeChallenges.map((active) => (
              <div key={`${active.event.id}:${active.challenge.id}`} className="az-card az-card-body">
                <strong style={{ display: 'block', fontSize: '0.90625rem' }}>{active.challenge.title}</strong>
                <p className="az-muted" style={{ margin: '0.1875rem 0 0.625rem', fontSize: '0.78125rem' }}>
                  Tied to {active.event.title} · {active.challenge.prompt}
                </p>
                <button type="button" className="az-btn az-btn-outline" onClick={() => setSubmitTarget(active)}>
                  Submit a frame
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="az-section-head">
        <span className="az-kicker">Field feed</span>
      </div>
      {discoveries === null && <p className="az-muted">Loading…</p>}
      {discoveries != null && discoveries.length === 0 && <p className="az-muted">No discoveries shared yet — be the first.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {discoveries?.map((discovery) => (
          <DiscoveryCard
            key={discovery.id}
            discovery={discovery}
            onVote={() => handleVote(discovery)}
            onReact={(emoji) => handleReact(discovery, emoji)}
            canInteract={Boolean(user)}
          />
        ))}
      </div>

      <ChallengeSubmitSheet active={submitTarget} onClose={() => setSubmitTarget(null)} onSubmitted={refreshChallenges} />

      <Sheet open={digestOpen} title="This week's top picks" onClose={() => setDigestOpen(false)}>
        <DigestWidget />
      </Sheet>
      <Sheet open={leaderboardOpen} title="Leaderboard" onClose={() => setLeaderboardOpen(false)}>
        <LeaderboardWidget />
      </Sheet>
    </>
  )
}

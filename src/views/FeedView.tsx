import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import {
  addComment,
  createDiscovery,
  listComments,
  listDiscoveries,
  REACTIONS,
  toggleReaction,
  toggleVote,
  type Discovery,
  type DiscoveryComment,
} from '../lib/discoveries'
import {
  PHOTO_CHALLENGES,
  discoveryCaptionForChallenge,
  type PhotoChallenge,
} from '../lib/photoChallenges'

function DiscoveryCard({ discovery, onVoted }: { discovery: Discovery; onVoted: () => void }) {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [comments, setComments] = useState<DiscoveryComment[] | null>(null)
  const [commentText, setCommentText] = useState('')

  async function toggleExpanded() {
    const next = !expanded
    setExpanded(next)
    if (next && comments === null) {
      setComments(await listComments(discovery.id))
    }
  }

  async function handleVote() {
    if (!user) return
    await toggleVote(discovery.id, discovery.hasVoted)
    onVoted()
  }

  async function handleReact(emoji: string) {
    if (!user) return
    await toggleReaction(discovery.id, emoji, discovery.myReactions.has(emoji))
    onVoted()
  }

  async function handleComment(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = commentText.trim()
    if (!trimmed || !user) return
    await addComment(discovery.id, trimmed)
    setCommentText('')
    setComments(await listComments(discovery.id))
  }

  return (
    <li className="discovery-card">
      {discovery.imageUrl && <img className="discovery-image" src={discovery.imageUrl} alt={discovery.caption} loading="lazy" />}
      <div className="discovery-body">
        <p className="discovery-caption">{discovery.caption}</p>
        <p className="discovery-meta">
          {discovery.authorName} &middot;{' '}
          {new Date(discovery.created).toLocaleDateString(undefined, { dateStyle: 'medium' })}
          {discovery.target && <> &middot; {discovery.target}</>}
        </p>
        {(discovery.camera || discovery.telescope || discovery.filters) && (
          <ul className="discovery-equipment">
            {discovery.camera && <li>Camera: {discovery.camera}</li>}
            {discovery.telescope && <li>Scope: {discovery.telescope}</li>}
            {discovery.filters && <li>Filters: {discovery.filters}</li>}
          </ul>
        )}
        <div className="discovery-actions">
          <button type="button" className={`discovery-vote${discovery.hasVoted ? ' is-active' : ''}`} onClick={handleVote} disabled={!user}>
            ▲ {discovery.voteCount}
          </button>
          <button type="button" className="discovery-comment-toggle" onClick={toggleExpanded}>
            Comments{comments ? ` (${comments.length})` : ''}
          </button>
        </div>
        <div className="discovery-reactions">
          {REACTIONS.map((reaction) => {
            const mine = discovery.myReactions.has(reaction.id)
            const count = discovery.reactionCounts[reaction.id] ?? 0
            return (
              <button
                key={reaction.id}
                type="button"
                className={`discovery-reaction${mine ? ' is-active' : ''}`}
                onClick={() => handleReact(reaction.id)}
                disabled={!user}
                title={reaction.label}
              >
                {reaction.glyph} {count > 0 ? count : ''}
              </button>
            )
          })}
        </div>
        {expanded && (
          <div className="discovery-comments">
            {comments === null && <p>Loading&hellip;</p>}
            {comments?.map((comment) => (
              <p key={comment.id} className="discovery-comment">
                <strong>{comment.authorName}</strong> {comment.text}
              </p>
            ))}
            {user ? (
              <form className="discovery-comment-form" onSubmit={handleComment}>
                <input
                  type="text"
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  placeholder="Add a comment"
                />
                <button type="submit">Post</button>
              </form>
            ) : (
              <p className="scrapbook-hint">Sign in (Settings) to comment.</p>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

function ChallengePicker({ selectedId, onSelect }: { selectedId: string; onSelect: (challenge: PhotoChallenge) => void }) {
  return (
    <div className="challenge-strip">
      {PHOTO_CHALLENGES.map((challenge) => (
        <button
          key={challenge.id}
          type="button"
          className={`challenge-card${selectedId === challenge.id ? ' is-active' : ''}`}
          onClick={() => onSelect(challenge)}
        >
          <span className="challenge-title">{challenge.title}</span>
          <span className="challenge-prompt">{challenge.prompt}</span>
          <span className="challenge-tip">{challenge.tip}</span>
        </button>
      ))}
    </div>
  )
}

function PostForm({ onPosted }: { onPosted: () => void }) {
  const [caption, setCaption] = useState('')
  const [target, setTarget] = useState('')
  const [camera, setCamera] = useState('')
  const [telescope, setTelescope] = useState('')
  const [filters, setFilters] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [selectedChallengeId, setSelectedChallengeId] = useState('')
  const [busy, setBusy] = useState(false)

  function selectChallenge(challenge: PhotoChallenge) {
    setSelectedChallengeId(challenge.id)
    setTarget((current) => current || challenge.target)
    setCaption((current) => current || discoveryCaptionForChallenge(challenge))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!caption.trim()) return
    setBusy(true)
    try {
      await createDiscovery({ caption: caption.trim(), target, camera, telescope, filters, image })
      setCaption('')
      setTarget('')
      setCamera('')
      setTelescope('')
      setFilters('')
      setImage(null)
      setSelectedChallengeId('')
      onPosted()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="discovery-form" onSubmit={handleSubmit}>
      <ChallengePicker selectedId={selectedChallengeId} onSelect={selectChallenge} />
      <textarea value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="What did you capture?" rows={2} required />
      <div className="discovery-form-grid">
        <input type="text" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="Target (e.g. Orion Nebula)" />
        <input type="text" value={camera} onChange={(event) => setCamera(event.target.value)} placeholder="Camera" />
        <input type="text" value={telescope} onChange={(event) => setTelescope(event.target.value)} placeholder="Telescope" />
        <input type="text" value={filters} onChange={(event) => setFilters(event.target.value)} placeholder="Filters" />
      </div>
      <input type="file" accept="image/*" onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
      <button type="submit" className="scrapbook-submit" disabled={busy}>
        Share discovery
      </button>
    </form>
  )
}

export function FeedView() {
  const { user } = useAuth()
  const [discoveries, setDiscoveries] = useState<Discovery[] | null>(null)

  async function refresh() {
    setDiscoveries(await listDiscoveries())
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <section className="widget-section">
      <h2>Feed</h2>
      {user ? <PostForm onPosted={refresh} /> : <p className="scrapbook-hint">Sign in (Settings) to share a discovery.</p>}
      {discoveries === null && <p>Loading&hellip;</p>}
      {discoveries !== null && discoveries.length === 0 && <p>No discoveries shared yet — be the first.</p>}
      {discoveries !== null && discoveries.length > 0 && (
        <ul className="discovery-list">
          {discoveries.map((discovery) => (
            <DiscoveryCard key={discovery.id} discovery={discovery} onVoted={refresh} />
          ))}
        </ul>
      )}
    </section>
  )
}

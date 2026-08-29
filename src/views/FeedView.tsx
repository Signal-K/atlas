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
import { PHOTO_CHALLENGES, discoveryCaptionForChallenge, type PhotoChallenge } from '../lib/photoChallenges'
import { BackIcon } from '../components/mobile/MobileIcon'

// A short, sketchbook-style caption line above the ruled caption text --
// Discovery has no separate title field, so this is derived from the
// target (when set) or the caption's own first few words.
function titleForDiscovery(discovery: Discovery): string {
  if (discovery.target) return `${discovery.target}, spotted`
  const words = discovery.caption.trim().split(/\s+/).slice(0, 6).join(' ')
  return words || 'Field sighting'
}

function metaForDiscovery(discovery: Discovery): string {
  const time = new Date(discovery.created).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  const gear = [discovery.camera, discovery.telescope, discovery.filters].filter(Boolean).join(' · ')
  return [discovery.target, time, gear].filter(Boolean).join(' · ')
}

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
    <li className="dt-feed-card">
      <div className="dt-feed-card-photo-wrap">
        {discovery.imageUrl ? (
          <img className="dt-feed-card-photo" src={discovery.imageUrl} alt={discovery.caption} loading="lazy" />
        ) : (
          <div className="dt-feed-card-photo dt-feed-card-photo--empty">No photo yet</div>
        )}
        <span className="dt-feed-card-pin">
          {(discovery.target ?? discovery.authorName).slice(0, 3).toUpperCase()}
        </span>
      </div>
      <div className="dt-feed-card-title">{titleForDiscovery(discovery)}</div>
      <p className="dt-feed-card-caption">{discovery.caption}</p>
      <div className="dt-feed-card-meta">
        {metaForDiscovery(discovery)} &middot; {discovery.authorName}
      </div>
      <div className="dt-feed-card-footer">
        <button type="button" className={`dt-feed-card-vote${discovery.hasVoted ? ' is-active' : ''}`} onClick={handleVote} disabled={!user}>
          &#9650; {discovery.voteCount}
        </button>
        <button type="button" className="dt-feed-card-comments-toggle" onClick={toggleExpanded}>
          {comments ? `${comments.length} comment${comments.length === 1 ? '' : 's'}` : 'Comments'}
        </button>
        <div className="dt-feed-card-reactions">
          {REACTIONS.map((reaction) => {
            const mine = discovery.myReactions.has(reaction.id)
            const count = discovery.reactionCounts[reaction.id] ?? 0
            return (
              <button
                key={reaction.id}
                type="button"
                className={`dt-feed-card-reaction${mine ? ' is-active' : ''}`}
                onClick={() => handleReact(reaction.id)}
                disabled={!user}
                title={reaction.label}
              >
                {reaction.glyph} {count > 0 ? count : ''}
              </button>
            )
          })}
        </div>
      </div>
      {expanded && (
        <div className="dt-feed-card-comments">
          {comments === null && <p className="dt-empty-hint">Loading&hellip;</p>}
          {comments?.map((comment) => (
            <p key={comment.id} className="dt-feed-card-comment">
              <strong>{comment.authorName}</strong> {comment.text}
            </p>
          ))}
          {user ? (
            <form className="dt-feed-card-comment-form" onSubmit={handleComment}>
              <input
                type="text"
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                placeholder="Add a comment"
              />
              <button type="submit">Post</button>
            </form>
          ) : (
            <p className="dt-empty-hint">Sign in (Settings) to comment.</p>
          )}
        </div>
      )}
    </li>
  )
}

function ChallengePicker({ selectedId, onSelect }: { selectedId: string; onSelect: (challenge: PhotoChallenge) => void }) {
  return (
    <div className="dt-sighting-challenges">
      {PHOTO_CHALLENGES.map((challenge) => (
        <button
          key={challenge.id}
          type="button"
          className={`dt-sighting-challenge${selectedId === challenge.id ? ' is-active' : ''}`}
          onClick={() => onSelect(challenge)}
          title={challenge.prompt}
        >
          {challenge.title}
        </button>
      ))}
    </div>
  )
}

function NewSightingForm({ onPosted, onCancel }: { onPosted: () => void; onCancel: () => void }) {
  const [caption, setCaption] = useState('')
  const [target, setTarget] = useState('')
  const [camera, setCamera] = useState('')
  const [telescope, setTelescope] = useState('')
  const [filters, setFilters] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [selectedChallengeId, setSelectedChallengeId] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function selectChallenge(challenge: PhotoChallenge) {
    setSelectedChallengeId((current) => (current === challenge.id ? '' : challenge.id))
    setTarget((current) => current || challenge.target)
    setCaption((current) => current || discoveryCaptionForChallenge(challenge))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!caption.trim()) return
    setBusy(true)
    try {
      await createDiscovery({ caption: caption.trim(), target, camera, telescope, filters, image })
      setSubmitted(true)
      window.setTimeout(onPosted, 900)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dt-feed-scope dt-sighting">
      <button type="button" className="dt-entry-back dt-sighting-back" onClick={onCancel}>
        <BackIcon />
        <span>Back to feed</span>
      </button>
      <h2 className="dt-sighting-title">New Sighting</h2>
      <p className="dt-sighting-subtitle">Add it to your journal, then share if you like</p>

      <form className="dt-sighting-form" onSubmit={handleSubmit}>
        <label className="dt-sighting-photo">
          <input type="file" accept="image/*" onChange={(event) => setImage(event.target.files?.[0] ?? null)} hidden />
          {image ? <span>{image.name}</span> : <span>Drop a photo, or add later</span>}
        </label>

        <div>
          <div className="dt-section-eyebrow">What did you see?</div>
          <textarea
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="the Perseids were incredible tonight&hellip;"
            rows={3}
            required
            className="dt-sighting-caption"
          />
        </div>

        <div>
          <div className="dt-section-eyebrow">Photo challenge (optional)</div>
          <ChallengePicker selectedId={selectedChallengeId} onSelect={selectChallenge} />
        </div>

        <div className="dt-sighting-grid">
          <label>
            <span className="dt-section-eyebrow">Target</span>
            <input type="text" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="e.g. Orion Nebula" />
          </label>
          <label>
            <span className="dt-section-eyebrow">Camera</span>
            <input type="text" value={camera} onChange={(event) => setCamera(event.target.value)} placeholder="e.g. iPhone 16 Pro" />
          </label>
          <label>
            <span className="dt-section-eyebrow">Telescope</span>
            <input type="text" value={telescope} onChange={(event) => setTelescope(event.target.value)} placeholder="&mdash;" />
          </label>
          <label>
            <span className="dt-section-eyebrow">Filters</span>
            <input type="text" value={filters} onChange={(event) => setFilters(event.target.value)} placeholder="&mdash;" />
          </label>
        </div>

        {submitted && (
          <div className="dt-sighting-confirm">
            <span>Added to your journal &middot; shared to the Field Feed</span>
          </div>
        )}

        <div className="dt-sighting-actions">
          <button type="submit" className="dt-sighting-submit" disabled={busy || submitted}>
            {submitted ? 'Shared ✓' : 'Share Sighting'}
          </button>
          <div className="dt-sighting-stamp">
            Field
            <br />
            Log
          </div>
        </div>
      </form>
    </div>
  )
}

export function FeedView() {
  const { user } = useAuth()
  const [discoveries, setDiscoveries] = useState<Discovery[] | null>(null)
  const [composing, setComposing] = useState(false)

  async function refresh() {
    setDiscoveries(await listDiscoveries())
  }

  useEffect(() => {
    refresh()
  }, [])

  if (composing) {
    return (
      <NewSightingForm
        onCancel={() => setComposing(false)}
        onPosted={() => {
          setComposing(false)
          refresh()
        }}
      />
    )
  }

  return (
    <div className="dt-feed-scope dt-feed">
      <div className="dt-feed-head">
        <h2 className="dt-feed-title">Field Feed</h2>
        <p className="dt-feed-subtitle">Shared sightings from tonight and beyond</p>
        {user ? (
          <button type="button" className="dt-feed-share-btn" onClick={() => setComposing(true)}>
            + Share what you saw tonight
          </button>
        ) : (
          <p className="dt-empty-hint">Sign in (Settings) to share a discovery.</p>
        )}
      </div>
      {discoveries === null && <p className="dt-empty-hint">Loading&hellip;</p>}
      {discoveries !== null && discoveries.length === 0 && <p className="dt-empty-hint">No discoveries shared yet — be the first.</p>}
      {discoveries !== null && discoveries.length > 0 && (
        <ul className="dt-feed-list">
          {discoveries.map((discovery) => (
            <DiscoveryCard key={discovery.id} discovery={discovery} onVoted={refresh} />
          ))}
        </ul>
      )}
    </div>
  )
}

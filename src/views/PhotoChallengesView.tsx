import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { getUpcomingEvents, pullSkyEvents } from '../lib/sync'
import type { SkyEvent } from '../lib/db'
import {
  getChallengesForEvent,
  listPhotoChallengeSubmissions,
  submitPhotoChallenge,
  type PhotoChallenge,
  type PhotoChallengeSubmission,
} from '../lib/photoChallenges'

interface ActiveChallenge {
  event: SkyEvent
  challenge: PhotoChallenge
}

function SubmissionForm({ active, onSubmitted }: { active: ActiveChallenge; onSubmitted: () => void }) {
  const [caption, setCaption] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!image) return
    setBusy(true)
    try {
      await submitPhotoChallenge({
        eventId: active.event.id,
        challengeId: active.challenge.id,
        caption: caption.trim(),
        image,
      })
      setCaption('')
      setImage(null)
      onSubmitted()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="discovery-form" onSubmit={handleSubmit}>
      <textarea
        value={caption}
        onChange={(inputEvent) => setCaption(inputEvent.target.value)}
        placeholder={active.challenge.prompt}
        rows={2}
      />
      <input
        type="file"
        accept="image/*"
        required
        onChange={(inputEvent) => setImage(inputEvent.target.files?.[0] ?? null)}
      />
      <button type="submit" className="scrapbook-submit" disabled={busy || !image}>
        Submit entry
      </button>
      <p className="scrapbook-hint">
        Entries are private until an admin approves them — you'll always see your own here either way.
      </p>
    </form>
  )
}

function ChallengeCard({
  active,
  user,
  submissions,
  onSubmitted,
}: {
  active: ActiveChallenge
  user: ReturnType<typeof useAuth>['user']
  submissions: PhotoChallengeSubmission[]
  onSubmitted: () => void
}) {
  const mine = submissions.filter((submission) => submission.eventId === active.event.id && submission.isMine)
  const approved = submissions.filter(
    (submission) => submission.eventId === active.event.id && submission.approved && !submission.isMine,
  )

  return (
    <li className="challenge-card is-active">
      <span className="challenge-title">{active.challenge.title}</span>
      <span className="challenge-prompt">{active.challenge.prompt}</span>
      <span className="challenge-tip">
        Tied to: {active.event.title} &middot; {active.challenge.tip}
      </span>
      {user ? (
        <SubmissionForm active={active} onSubmitted={onSubmitted} />
      ) : (
        <p className="scrapbook-hint">Sign in (Settings) to submit an entry.</p>
      )}
      {mine.length > 0 && (
        <div className="discovery-list">
          <p className="discovery-meta">Your entries</p>
          {mine.map((submission) => (
            <p key={submission.id} className="discovery-caption">
              {submission.approved ? 'Approved' : 'Pending approval'} &middot; {submission.caption || 'No caption'}
            </p>
          ))}
        </div>
      )}
      {approved.length > 0 && (
        <div className="discovery-list">
          <p className="discovery-meta">Approved entries from others</p>
          {approved.map((submission) => (
            <img
              key={submission.id}
              className="discovery-image"
              src={submission.imageUrl}
              alt={submission.caption || active.challenge.title}
              loading="lazy"
            />
          ))}
        </div>
      )}
    </li>
  )
}

export function PhotoChallengesView() {
  const { user } = useAuth()
  const [activeChallenges, setActiveChallenges] = useState<ActiveChallenge[] | null>(null)
  const [submissions, setSubmissions] = useState<PhotoChallengeSubmission[]>([])

  async function refresh() {
    await pullSkyEvents()
    const upcoming = await getUpcomingEvents(50)
    const matched = upcoming.flatMap((event) =>
      getChallengesForEvent(event).map((challenge) => ({ event, challenge })),
    )
    setActiveChallenges(matched)
    setSubmissions(user ? await listPhotoChallengeSubmissions() : [])
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  return (
    <section className="widget-section">
      <h2>Photo Challenges</h2>
      <p className="scrapbook-hint">
        Distinct from your Scrapbook (private journal) — challenges are tied to specific upcoming sky events, and
        entries are moderated before appearing publicly.
      </p>
      {activeChallenges === null && <p>Loading&hellip;</p>}
      {activeChallenges !== null && activeChallenges.length === 0 && (
        <p>No sky events with a matching challenge right now — check back soon.</p>
      )}
      {activeChallenges !== null && activeChallenges.length > 0 && (
        <ul className="challenge-strip challenge-strip-vertical">
          {activeChallenges.map((active) => (
            <ChallengeCard
              key={`${active.event.id}:${active.challenge.id}`}
              active={active}
              user={user}
              submissions={submissions}
              onSubmitted={refresh}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

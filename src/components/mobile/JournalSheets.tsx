import { useState } from 'react'
import { Sheet } from './Sheet'
import { useToast } from './Toast'
import { useEntryPhotoUrl } from '../../lib/useEntryPhotoUrl'
import { shareObservation } from '../../lib/sharing'
import { submitPhotoChallenge, type PhotoChallenge } from '../../lib/photoChallenges'
import { useAuth } from '../../lib/auth'
import { RATING_LABEL } from './CaptureSheet'
import type { ObservationLogEntry, SkyEvent } from '../../lib/db'

export interface EntryDetailSheetProps {
  entry: ObservationLogEntry | null
  onClose: () => void
  onShared: () => void
}

export function EntryDetailSheet({ entry, onClose, onShared }: EntryDetailSheetProps) {
  const { user } = useAuth()
  const toast = useToast()
  const photoUrl = useEntryPhotoUrl(entry?.photo)
  const [sharing, setSharing] = useState(false)

  async function handleShare() {
    if (!entry || sharing) return
    setSharing(true)
    try {
      const url = await shareObservation(entry)
      await navigator.clipboard.writeText(url)
      toast('Share link copied.')
      onShared()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Sign in to share this entry.')
    } finally {
      setSharing(false)
    }
  }

  return (
    <Sheet open={entry != null} title={entry?.targetName ?? 'Entry'} onClose={onClose}>
      {entry && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {photoUrl && (
            <div
              className="az-thumb-lg"
              style={{ height: '11rem', backgroundImage: `url(${photoUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            />
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {entry.attemptRating && (
              <span className="az-pill" style={{ '--pill-hue': ratingHue(entry.attemptRating) } as React.CSSProperties}>
                {RATING_LABEL[entry.attemptRating].toUpperCase()}
              </span>
            )}
            <span className="az-kicker">
              {new Date(entry.observedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          </div>

          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>
            {entry.locationLabel && (
              <>
                <dt className="az-muted">Location</dt>
                <dd style={{ margin: 0 }}>{entry.locationLabel}</dd>
              </>
            )}
            {entry.conditionSummary && (
              <>
                <dt className="az-muted">Conditions</dt>
                <dd style={{ margin: 0 }}>{entry.conditionSummary}</dd>
              </>
            )}
            {entry.deviceUsed && (
              <>
                <dt className="az-muted">Device</dt>
                <dd style={{ margin: 0 }}>{entry.deviceUsed}</dd>
              </>
            )}
            {entry.cameraRecipeUsed && (
              <>
                <dt className="az-muted">Recipe</dt>
                <dd style={{ margin: 0 }}>{entry.cameraRecipeUsed}</dd>
              </>
            )}
          </dl>

          {entry.note && <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.5 }}>{entry.note}</p>}

          {entry.aiCaption && (
            <p style={{ margin: 0, fontSize: '0.8125rem', lineHeight: 1.5, color: 'var(--az-violet-strong)' }}>
              <span className="az-kicker">AI caption</span>
              <br />
              {entry.aiCaption}
            </p>
          )}

          {user && (
            <button type="button" className="az-btn az-btn-outline az-btn-block" onClick={handleShare} disabled={sharing}>
              {entry.isPublic ? 'Copy share link' : sharing ? 'Sharing…' : 'Share publicly'}
            </button>
          )}
        </div>
      )}
    </Sheet>
  )
}

function ratingHue(rating: NonNullable<ObservationLogEntry['attemptRating']>): number {
  return { poor: 25, ok: 250, good: 145, great: 288 }[rating]
}

export interface ActiveChallenge {
  event: SkyEvent
  challenge: PhotoChallenge
}

export interface ChallengeSubmitSheetProps {
  active: ActiveChallenge | null
  onClose: () => void
  onSubmitted: () => void
}

export function ChallengeSubmitSheet({ active, onClose, onSubmitted }: ChallengeSubmitSheetProps) {
  const toast = useToast()
  const [caption, setCaption] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  function handleClose() {
    setCaption('')
    setImage(null)
    setBusy(false)
    onClose()
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!active || !image || busy) return
    setBusy(true)
    try {
      await submitPhotoChallenge({ eventId: active.event.id, challengeId: active.challenge.id, caption: caption.trim(), image })
      toast('Submitted for review.')
      setCaption('')
      setImage(null)
      onSubmitted()
      onClose()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Sign in to submit a frame.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={active != null} title="Submit a frame" onClose={handleClose}>
      {active && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ background: 'var(--chip)', borderRadius: '0.75rem', padding: '0.625rem 0.75rem' }}>
            <span className="az-kicker">{active.challenge.title}</span>
            <p className="az-muted" style={{ margin: '0.1875rem 0 0', fontSize: '0.8125rem' }}>
              {active.challenge.prompt}
            </p>
          </div>

          <textarea
            className="az-textarea"
            value={caption}
            onChange={(inputEvent) => setCaption(inputEvent.target.value)}
            placeholder={active.challenge.tip}
            rows={3}
          />

          <label
            className="az-btn az-btn-outline az-btn-block"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            htmlFor="journal-challenge-photo"
          >
            {image ? image.name : 'Add a photo (required)'}
          </label>
          <input
            id="journal-challenge-photo"
            type="file"
            accept="image/*"
            required
            hidden
            onChange={(inputEvent) => setImage(inputEvent.target.files?.[0] ?? null)}
          />

          <button type="submit" className="az-btn az-btn-primary az-btn-block" disabled={!image || busy}>
            {busy ? 'Submitting…' : 'Submit entry'}
          </button>
          <p className="az-muted" style={{ margin: 0, fontSize: '0.71875rem' }}>
            Entries are private until an admin approves them — you'll always see your own.
          </p>
        </form>
      )}
    </Sheet>
  )
}

import { useEffect, useState } from 'react'
import { Sheet } from './Sheet'
import { useToast } from './Toast'
import { db, type AttemptRating, type ObservationLogEntry } from '../../lib/db'
import { pushObservation } from '../../lib/sync'
import { pushCityStampFromObservation } from '../../lib/cityStamps'
import { pushCitizenScienceBadgeFromObservation, PROJECT_LABELS } from '../../lib/citizenScienceBadges'
import { recordWeeklyActivity } from '../../lib/streaks'
import { requestPhotoCaption } from '../../lib/photoCaption'
import { suggestObservationCaption } from '../../lib/observationCaptionSuggestion'
import { optimizeObservationPhoto, PhotoOptimizationError } from '../../lib/photoOptimization'
import { isAtlasMediaEnabled } from '../../lib/atlasMedia'
import { useAuth } from '../../lib/auth'
import { trackEvent } from '../../lib/analytics'
import type { ObservationDraft } from '../../lib/observationDraft'
import type { CurrentLocation } from '../../lib/currentLocation'

const LOCAL_USER_ID = 'local'

// Real union from db.ts -- the Atlas Mobile mockup's 5-option result picker
// (saw it / partially saw it / photographed it / missed it / clouded out)
// doesn't exist in the data model, so this sticks to the 4 real values
// rather than inventing outcomes the app can't actually store.
const RATING_OPTIONS: AttemptRating[] = ['poor', 'ok', 'good', 'great']
export const RATING_LABEL: Record<AttemptRating, string> = {
  poor: 'Poor',
  ok: 'OK',
  good: 'Good',
  great: 'Great',
}
export const RATING_HUE: Record<AttemptRating, number> = {
  poor: 25,
  ok: 250,
  good: 145,
  great: 288,
}

export interface CaptureSheetProps {
  open: boolean
  onClose: () => void
  draft: ObservationDraft | null
  onDraftConsumed: () => void
  currentLocation: CurrentLocation
  onSaved: () => void
}

export function CaptureSheet({ open, onClose, draft, onDraftConsumed, currentLocation, onSaved }: CaptureSheetProps) {
  const { user } = useAuth()
  const toast = useToast()
  const scopeId = user?.id ?? LOCAL_USER_ID
  const [note, setNote] = useState('')
  const [rating, setRating] = useState<AttemptRating | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreparing, setPhotoPreparing] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Sheet.tsx unmounts its children while closed, but this component keeps
  // its hooks alive across opens (it owns the <Sheet>, not the other way
  // round) -- reset explicitly on every open instead of relying on unmount.
  useEffect(() => {
    if (!open) return
    setNote(draft ? suggestObservationCaption(draft) : '')
    setRating(null)
    setPhoto(null)
    setPhotoPreparing(false)
    setPhotoError(null)
    setSaving(false)
  }, [open, draft])

  function handleClose() {
    if (draft) onDraftConsumed()
    onClose()
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = note.trim()
    if (!trimmed || saving) return
    if (draft?.citizenScienceProject && !photo) {
      setPhotoError('Add a sky photo to submit this observation.')
      return
    }
    setSaving(true)

    let entryPhoto = photo
    if (photo && isAtlasMediaEnabled()) {
      setPhotoPreparing(true)
      setPhotoError(null)
      try {
        entryPhoto = await optimizeObservationPhoto(photo)
      } catch (error) {
        setPhotoError(error instanceof PhotoOptimizationError ? error.message : 'This photo could not be prepared for upload.')
        setPhotoPreparing(false)
        setSaving(false)
        return
      }
      setPhotoPreparing(false)
    }

    const entry: ObservationLogEntry = {
      id: crypto.randomUUID(),
      userId: scopeId,
      observedAt: new Date().toISOString(),
      note: trimmed,
      ...(draft
        ? {
            eventId: draft.eventId,
            targetName: draft.targetName,
            deviceUsed: draft.deviceUsed,
            cameraRecipeUsed: draft.cameraRecipeUsed,
            locationLabel: draft.locationLabel ?? currentLocation.name,
            ...(draft.citizenScienceProject ? { citizenScienceProject: draft.citizenScienceProject } : {}),
            ...(draft.latitude != null ? { latitude: draft.latitude } : {}),
            ...(draft.longitude != null ? { longitude: draft.longitude } : {}),
          }
        : { locationLabel: currentLocation.name }),
      ...(rating ? { attemptRating: rating } : {}),
      ...(entryPhoto ? { photo: entryPhoto } : {}),
    }

    await db.observations.add(entry)
    trackEvent('Logged observation', {
      hasTarget: draft != null,
      rating: rating ?? undefined,
      hasPhoto: entryPhoto != null,
      source: 'journal_mobile',
    })

    let remoteId: string | null = null
    try {
      remoteId = await pushObservation(entry)
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'We couldn’t add this photo right now.')
    }
    await pushCityStampFromObservation(entry)
    await pushCitizenScienceBadgeFromObservation(entry)
    await recordWeeklyActivity()

    // Sky Pass-only, best-effort AI caption -- never blocks the save, and
    // silently does nothing if the deployment/user isn't set up for it.
    if (entry.photo && user?.entitled && remoteId) {
      requestPhotoCaption({
        photo: entry.photo,
        targetName: entry.targetName,
        observationId: entry.id,
        observationRemoteId: remoteId,
      }).catch(() => {})
    }

    setSaving(false)
    toast('Session logged.')
    if (draft) onDraftConsumed()
    onSaved()
    onClose()
  }

  return (
    <Sheet open={open} title="Log tonight's session" onClose={handleClose}>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {draft && (
          <div style={{ background: 'var(--chip)', borderRadius: '0.75rem', padding: '0.625rem 0.75rem' }}>
            <span className="az-kicker">Logging for</span>
            <strong style={{ display: 'block', fontSize: '0.9375rem', marginTop: '0.125rem' }}>{draft.targetName}</strong>
            {draft.citizenScienceProject && (
              <p className="az-muted" style={{ margin: '0.25rem 0 0', fontSize: '0.75rem' }}>
                A sky photo is required — Atlas processes it into a {PROJECT_LABELS[draft.citizenScienceProject] ?? draft.citizenScienceProject} submission automatically.
              </p>
            )}
          </div>
        )}

        <div>
          <span className="az-kicker">How did it go?</span>
          <div className="az-chip-row" style={{ marginTop: '0.4375rem' }}>
            {RATING_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={`az-chip${rating === option ? ' is-active' : ''}`}
                onClick={() => setRating(rating === option ? null : option)}
              >
                {RATING_LABEL[option]}
              </button>
            ))}
          </div>
        </div>

        <textarea
          className="az-textarea"
          value={note}
          onChange={(inputEvent) => setNote(inputEvent.target.value)}
          placeholder="What did you see tonight?"
          rows={4}
          required
        />

        <label
          className="az-btn az-btn-outline az-btn-block"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          htmlFor="journal-capture-photo"
        >
          {photo ? photo.name : 'Add a photo'}
        </label>
        <input
          id="journal-capture-photo"
          type="file"
          accept="image/*"
          hidden
          onChange={(inputEvent) => {
            setPhoto(inputEvent.target.files?.[0] ?? null)
            setPhotoError(null)
          }}
        />
        {isAtlasMediaEnabled() && (
          <p className="az-muted" style={{ margin: 0, fontSize: '0.71875rem' }}>
            Photos are optimised to a 4096px JPEG before private upload. Originals stay on your device.
          </p>
        )}
        {photoError && (
          <p role="alert" style={{ color: 'var(--az-amber-strong)', fontSize: '0.75rem', margin: 0 }}>
            {photoError}
          </p>
        )}

        <button
          type="submit"
          className="az-btn az-btn-primary az-btn-block"
          disabled={!note.trim() || saving || Boolean(draft?.citizenScienceProject && !photo)}
        >
          {photoPreparing ? 'Preparing photo…' : saving ? 'Saving…' : 'Save session'}
        </button>
      </form>
    </Sheet>
  )
}

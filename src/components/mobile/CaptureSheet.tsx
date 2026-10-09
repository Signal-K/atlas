import { useEffect, useMemo, useRef, useState } from 'react'
import { Sheet } from './Sheet'
import { useToast } from './Toast'
import { db, type AttemptRating, type ObservationLogEntry } from '../../lib/db'
import { pushObservation } from '../../lib/sync'
import { pushCityStampFromObservation } from '../../lib/cityStamps'
import { recordWeeklyActivity } from '../../lib/streaks'
import { requestPhotoCaption } from '../../lib/photoCaption'
import { suggestObservationCaption } from '../../lib/observationCaptionSuggestion'
import { optimizeObservationPhoto, PhotoOptimizationError } from '../../lib/photoOptimization'
import { isAtlasMediaEnabled } from '../../lib/atlasMedia'
import { useAuth } from '../../lib/auth'
import { trackEvent } from '../../lib/analytics'
import { describeAward, progressAnalyticsEvents } from '../../lib/progress'
import { snapshotProgress } from '../../lib/progressSnapshot'
import type { ObservationDraft } from '../../lib/observationDraft'
import type { CurrentLocation } from '../../lib/currentLocation'
import { FormStatus } from '../forms/FormStatus'
import { FormSurface } from '../forms/FormSurface'
import { useDirtyFormRegistration } from '../../lib/dirtyForms'
import { clearQueuedSyncItems, enqueueObservationRetry, flushSyncQueue } from '../../lib/syncQueue'

const LOCAL_USER_ID = 'local'
const CAPTURE_DRAFT_KEY_PREFIX = 'atlas-capture-sheet-draft-v1:'

interface CaptureDraftState {
  note: string
  rating: AttemptRating | null
  sourceEventId: string | null
}

function readCaptureDraft(key: string): CaptureDraftState | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CaptureDraftState>
    const rating = parsed.rating
    if (typeof parsed.note !== 'string') return null
    if (rating != null && !RATING_OPTIONS.includes(rating)) return null
    return {
      note: parsed.note,
      rating: rating ?? null,
      sourceEventId: typeof parsed.sourceEventId === 'string' ? parsed.sourceEventId : null,
    }
  } catch {
    return null
  }
}

function writeCaptureDraft(key: string, draft: CaptureDraftState) {
  try {
    window.localStorage.setItem(key, JSON.stringify(draft))
  } catch {
    // Ignore storage failures (private mode/quota) and keep in-memory state.
  }
}

function clearCaptureDraft(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Storage unavailable; nothing to clear.
  }
}

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
  const draftStorageKey = useMemo(() => `${CAPTURE_DRAFT_KEY_PREFIX}${scopeId}`, [scopeId])
  const submitLockedRef = useRef(false)
  const [note, setNote] = useState('')
  const [rating, setRating] = useState<AttemptRating | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreparing, setPhotoPreparing] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [pendingSyncEntryId, setPendingSyncEntryId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const busy = saving || photoPreparing
  const dirty = note.trim().length > 0 || rating != null || photo != null || pendingSyncEntryId != null

  useDirtyFormRegistration(`capture-sheet:${scopeId}`, open && dirty)

  // Sheet.tsx unmounts its children while closed, but this component keeps
  // its hooks alive across opens (it owns the <Sheet>, not the other way
  // round) -- reset explicitly on every open instead of relying on unmount.
  useEffect(() => {
    if (!open) return
    const persisted = readCaptureDraft(draftStorageKey)
    const sourceEventId = draft?.eventId ?? null
    const canRestore = persisted != null && persisted.sourceEventId === sourceEventId
    setNote(canRestore ? persisted.note : draft ? suggestObservationCaption(draft) : '')
    setRating(canRestore ? persisted!.rating : null)
    setPhoto(null)
    setPhotoPreparing(false)
    setPhotoError(null)
    setSyncError(null)
    setPendingSyncEntryId(null)
    setSaving(false)
  }, [open, draft, draftStorageKey])

  useEffect(() => {
    if (!open) return
    const sourceEventId = draft?.eventId ?? null
    if (!note.trim() && rating == null) {
      clearCaptureDraft(draftStorageKey)
      return
    }
    writeCaptureDraft(draftStorageKey, { note, rating, sourceEventId })
  }, [open, note, rating, draftStorageKey, draft?.eventId])

  function closeAndReset() {
    clearCaptureDraft(draftStorageKey)
    if (draft) onDraftConsumed()
    setPendingSyncEntryId(null)
    setSyncError(null)
    onClose()
  }

  function handleClose() {
    if (!dirty) {
      closeAndReset()
      return
    }
    const discard = window.confirm(
      pendingSyncEntryId
        ? 'Close this sheet? Atlas already saved your entry locally and will keep retrying sync in the background.'
        : 'Discard this draft?',
    )
    if (!discard) return
    closeAndReset()
  }

  async function retryPendingSync() {
    if (!pendingSyncEntryId || busy || submitLockedRef.current) return
    submitLockedRef.current = true
    setSaving(true)
    setSyncError(null)
    try {
      await enqueueObservationRetry(pendingSyncEntryId)
      await flushSyncQueue()
      const entry = await db.observations.get(pendingSyncEntryId)
      if (!entry?.remoteId) {
        setSyncError('Still waiting to sync. Atlas queued another retry.')
        return
      }
      await clearQueuedSyncItems('atlas_observations', pendingSyncEntryId)
      toast('Synced to your account.')
      await onSaved()
      closeAndReset()
    } finally {
      submitLockedRef.current = false
      setSaving(false)
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = note.trim()
    if (!trimmed || busy || submitLockedRef.current) return
    submitLockedRef.current = true
    setSaving(true)
    setSyncError(null)
    try {
      let entryPhoto = photo
      if (photo && isAtlasMediaEnabled()) {
        setPhotoPreparing(true)
        setPhotoError(null)
        try {
          entryPhoto = await optimizeObservationPhoto(photo)
        } catch (error) {
          setPhotoError(error instanceof PhotoOptimizationError ? error.message : 'This photo could not be prepared for upload.')
          return
        } finally {
          setPhotoPreparing(false)
        }
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
            }
          : { locationLabel: currentLocation.name }),
        ...(rating ? { attemptRating: rating } : {}),
        ...(entryPhoto ? { photo: entryPhoto } : {}),
      }

      const progressBefore = await snapshotProgress(scopeId, user?.firstTourBadge ?? null)
      await db.observations.add(entry)
      const progressAfter = await snapshotProgress(scopeId, user?.firstTourBadge ?? null)
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
        setSyncError(error instanceof Error ? error.message : 'This entry was saved locally, but sync failed.')
      }
      await pushCityStampFromObservation(entry)
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

      for (const event of progressAnalyticsEvents(progressBefore, progressAfter, 'check_in')) trackEvent(event.name, event.properties)
      toast(describeAward(progressBefore, progressAfter))
      await onSaved()

      if (!remoteId) {
        await enqueueObservationRetry(entry.id)
        setPendingSyncEntryId(entry.id)
        setSyncError('Saved on this device. Atlas queued a retry to sync your account.')
        return
      }

      await clearQueuedSyncItems('atlas_observations', entry.id)
      closeAndReset()
    } finally {
      setSaving(false)
      submitLockedRef.current = false
    }
  }

  return (
    <Sheet open={open} title="Log tonight's session" onClose={handleClose}>
      <FormSurface
        onSubmit={handleSave}
        footer={
          <div className="az-btn-row">
            {pendingSyncEntryId ? (
              <button
                type="button"
                className="az-btn az-btn-outline az-btn-block az-btn-stable"
                onClick={() => void retryPendingSync()}
                disabled={busy}
              >
                <span className="az-btn-label">Retry sync</span>
                <span className={`az-btn-spinner${busy ? ' is-visible' : ''}`} aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="submit"
              className="az-btn az-btn-primary az-btn-block az-btn-stable"
              disabled={!note.trim() || busy}
              aria-busy={busy}
            >
              <span className="az-btn-label">Save session</span>
              <span className={`az-btn-spinner${busy ? ' is-visible' : ''}`} aria-hidden="true" />
            </button>
          </div>
        }
      >
        {draft && (
          <div style={{ background: 'var(--chip)', borderRadius: '0.75rem', padding: '0.625rem 0.75rem' }}>
            <span className="az-kicker">Logging for</span>
            <strong style={{ display: 'block', fontSize: '0.9375rem', marginTop: '0.125rem' }}>{draft.targetName}</strong>
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
          enterKeyHint="done"
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
        <FormStatus tone={photoError || syncError ? 'error' : 'neutral'} live={photoError || syncError ? 'assertive' : 'polite'} message={photoError ?? syncError} />
      </FormSurface>
    </Sheet>
  )
}

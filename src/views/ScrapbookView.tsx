import { useEffect, useState } from 'react'
import { db, type AttemptRating, type ObservationLogEntry } from '../lib/db'
import { pushObservation } from '../lib/sync'
import { recordWeeklyActivity } from '../lib/streaks'
import { createDiscovery } from '../lib/discoveries'
import { getScrapbookPrompt } from '../lib/scrapbookPrompt'
import { useAuth } from '../lib/auth'
import { ObservationCard } from '../components/ObservationCard'
import { trackEvent } from '../lib/analytics'
import type { ObservationDraft } from '../lib/observationDraft'

// Entries made while signed out are scoped to this fixed local id so the
// Scrapbook still works fully offline-first with no account. Once signed
// in, new entries are scoped to the real user id (and also pushed to
// PocketBase) — entries logged before signing in stay under 'local' and
// won't reappear once signed in; that's an acceptable gap for now.
const LOCAL_USER_ID = 'local'

const RATING_OPTIONS: AttemptRating[] = ['poor', 'ok', 'good', 'great']
const RATING_LABEL: Record<AttemptRating, string> = {
  poor: 'Poor',
  ok: 'OK',
  good: 'Good',
  great: 'Great',
}

interface ScrapbookViewProps {
  draft: ObservationDraft | null
  onDraftConsumed: () => void
}

export function ScrapbookView({ draft, onDraftConsumed }: ScrapbookViewProps) {
  const { user } = useAuth()
  const scopeId = user?.id ?? LOCAL_USER_ID
  const [entries, setEntries] = useState<ObservationLogEntry[]>([])
  const [note, setNote] = useState('')
  const [prompt, setPrompt] = useState('What did you see tonight?')
  const [rating, setRating] = useState<AttemptRating | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)

  async function refresh() {
    const all = await db.observations.where('userId').equals(scopeId).reverse().sortBy('observedAt')
    setEntries(all)
  }

  useEffect(() => {
    refresh()
  }, [scopeId])

  useEffect(() => {
    getScrapbookPrompt().then(setPrompt)
  }, [])

  function clearDraft() {
    setRating(null)
    setPhoto(null)
    onDraftConsumed()
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = note.trim()
    if (!trimmed) return

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
            locationLabel: draft.locationLabel,
          }
        : {}),
      ...(rating ? { attemptRating: rating } : {}),
      ...(photo ? { photo } : {}),
    }
    await db.observations.add(entry)
    trackEvent('Logged observation', { hasTarget: draft != null, rating: rating ?? undefined, hasPhoto: photo != null })
    setNote('')
    clearDraft()
    await refresh()
    await pushObservation(entry)
    await recordWeeklyActivity()
  }

  // Reuses the Discoveries feed's own post creation (src/lib/discoveries.ts)
  // -- a forwarded entry is just a discovery with no image/equipment fields,
  // same as posting straight from the Feed tab would produce.
  async function handleShare(entry: ObservationLogEntry) {
    if (!entry.note) return
    await createDiscovery({ caption: entry.note, target: entry.targetName ?? '', camera: entry.deviceUsed ?? '', telescope: '', filters: '', image: null })
    await db.observations.update(entry.id, { sharedToFeed: true })
    await refresh()
  }

  return (
    <section className="widget-section">
      <h2>Scrapbook</h2>
      {!user && <p className="scrapbook-hint">Sign in (Settings) to sync your notes to your account.</p>}
      {draft && (
        <div className="scrapbook-draft-banner">
          <span>
            Logging attempt for <strong>{draft.targetName}</strong>
          </span>
          <button type="button" onClick={clearDraft}>
            Cancel
          </button>
        </div>
      )}
      <form className="scrapbook-form" onSubmit={handleSave}>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={prompt}
          rows={3}
        />
        <div className="scrapbook-rating-picker">
          {RATING_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={rating === option ? 'is-active' : ''}
              onClick={() => setRating(rating === option ? null : option)}
            >
              {RATING_LABEL[option]}
            </button>
          ))}
        </div>
        <input type="file" accept="image/*" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} />
        <button type="submit" className="scrapbook-submit">
          Save observation
        </button>
      </form>
      {entries.length === 0 ? (
        <p>Nothing logged yet — your sky-watching notes will show up here.</p>
      ) : (
        <ul className="row-list">
          {entries.map((entry, index) => (
            <li
              key={entry.id}
              className="scrapbook-entry"
              style={{ '--scrapbook-tilt': `${index % 2 === 0 ? -0.6 : 0.6}deg` } as React.CSSProperties}
            >
              <ObservationCard entry={entry} />
              <div className="scrapbook-entry-footer">
                {user && (
                  <button
                    type="button"
                    className="scrapbook-share"
                    onClick={() => handleShare(entry)}
                    disabled={entry.sharedToFeed}
                  >
                    {entry.sharedToFeed ? 'Shared to Feed' : 'Share to Feed'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

import { useEffect, useState } from 'react'
import type { AttemptRating, ObservationLogEntry } from '../lib/db'

const RATING_LABEL: Record<AttemptRating, string> = {
  poor: 'Poor',
  ok: 'OK',
  good: 'Good',
  great: 'Great',
}

// Shareable observation card (AT epic 3, task 4): a compact visual summary
// of a logged attempt. Component/data only for now, matching the sprint's
// scope -- no public profile surface consumes this yet.
export function ObservationCard({ entry }: { entry: ObservationLogEntry }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!entry.photo) {
      setPhotoUrl(null)
      return
    }
    const url = URL.createObjectURL(entry.photo)
    setPhotoUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [entry.photo])

  return (
    <div className="observation-card">
      {photoUrl && (
        <div className="observation-card-photo">
          <img src={photoUrl} alt={entry.targetName ?? 'Observation'} />
        </div>
      )}
      <div className="observation-card-body">
        {entry.targetName && <p className="observation-card-target">{entry.targetName}</p>}
        <p className="observation-card-meta">
          {new Date(entry.observedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          {entry.locationLabel ? ` · ${entry.locationLabel}` : ''}
          {entry.deviceUsed ? ` · ${entry.deviceUsed}` : ''}
        </p>
        {entry.attemptRating && (
          <span className={`observation-card-rating observation-card-rating--${entry.attemptRating}`}>
            {RATING_LABEL[entry.attemptRating]}
          </span>
        )}
        {entry.note && <p className="observation-card-note">{entry.note}</p>}
      </div>
    </div>
  )
}

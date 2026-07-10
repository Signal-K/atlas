import type { AttemptRating } from '../lib/db'
import type { PublicObservationCard } from '../lib/sharing'

const RATING_LABEL: Record<AttemptRating, string> = {
  poor: 'Poor',
  ok: 'OK',
  good: 'Good',
  great: 'Great',
}

// Public-facing render of a shared observation (STS-175). Deliberately
// narrower than ObservationCard's private fields -- no locationLabel or
// conditionSummary -- since this is what a stranger sees.
export function ShareCard({ data }: { data: PublicObservationCard }) {
  return (
    <div className="share-card">
      {data.photoUrl && (
        <div className="share-card-photo">
          <img src={data.photoUrl} alt={data.targetName ?? 'Sky-watching observation'} />
        </div>
      )}
      <div className="share-card-body">
        {data.targetName && <p className="share-card-target">{data.targetName}</p>}
        <p className="share-card-meta">
          {new Date(data.observedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
          {data.deviceUsed ? ` · ${data.deviceUsed}` : ''}
          {data.cameraRecipeUsed ? ` · ${data.cameraRecipeUsed}` : ''}
        </p>
        {data.attemptRating && (
          <span className={`share-card-rating share-card-rating--${data.attemptRating}`}>{RATING_LABEL[data.attemptRating]}</span>
        )}
        {data.note && <p className="share-card-note">{data.note}</p>}
      </div>
    </div>
  )
}

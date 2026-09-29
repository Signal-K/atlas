type PublicShareRecoveryProps = {
  item: 'observation' | 'city stamp'
  state: 'loading' | 'unavailable'
}

// Public share successes intentionally stay as bare cards for easy reading
// and clean link previews. Only their transient and unavailable states need
// Atlas context and a useful way forward.
export function PublicShareRecovery({ item, state }: PublicShareRecoveryProps) {
  const loading = state === 'loading'
  const itemLabel = item === 'city stamp' ? 'city stamp' : 'shared observation'

  return (
    <main className="public-share-recovery" aria-busy={loading}>
      <div className="public-share-recovery-card">
        <a className="public-share-recovery-brand" href="/" aria-label="Atlas home">ATLAS</a>
        <p className="az-kicker">{loading ? 'OPENING A SHARED VIEW' : 'SHARED VIEW UNAVAILABLE'}</p>
        <h1>{loading ? `Loading this ${itemLabel}…` : `This ${itemLabel} isn’t available.`}</h1>
        <p>
          {loading
            ? 'Atlas is preparing the shared view.'
            : 'It may have been made private, removed, or the link may be incomplete.'}
        </p>
        {!loading && <a className="az-btn az-btn-primary public-share-recovery-cta" href="/">Explore tonight’s sky</a>}
      </div>
    </main>
  )
}

import { useEffect, useState } from 'react'
import { ShareCard } from '../components/ShareCard'
import { getPublicObservation, type PublicObservationCard } from '../lib/sharing'
import { trackEvent } from '../lib/analytics'

// Standalone public route (STS-175), rendered by main.tsx in place of the
// full app shell for /p/:id -- no Sidebar, no auth-gated views, just the one
// shared card. Kept intentionally outside the Sidebar/View system since it
// must work for a signed-out stranger who has never opened the app before.
export function SharePage({ remoteId }: { remoteId: string }) {
  const [state, setState] = useState<'loading' | 'not-found' | PublicObservationCard>('loading')

  useEffect(() => {
    let cancelled = false
    getPublicObservation(remoteId).then((data) => {
      if (cancelled) return
      setState(data ?? 'not-found')
      trackEvent('Viewed public share card', { found: data != null })
    })
    return () => {
      cancelled = true
    }
  }, [remoteId])

  return (
    <div className="share-page">
      {state === 'loading' && <p className="share-page-status">Loading…</p>}
      {state === 'not-found' && <p className="share-page-status">This card isn't available — it may have been unshared or removed.</p>}
      {state !== 'loading' && state !== 'not-found' && <ShareCard data={state} />}
    </div>
  )
}

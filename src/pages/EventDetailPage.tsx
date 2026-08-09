import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { categoryFor } from '../lib/eventCategories'
import { fetchEvent, type AtlasEvent } from '../lib/events'
import { addToPlan, getPlanState, removeFromPlan } from '../lib/plans'
import { hasLoggedObservation, logObservation } from '../lib/observations'
import type { AuthUser } from '../lib/auth'

export interface EventDetailPageProps {
  user: AuthUser
  entitled: boolean
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function EventDetailPage({ user, entitled }: EventDetailPageProps) {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const passedEvent = (location.state as { event?: AtlasEvent } | null)?.event

  const [event, setEvent] = useState<AtlasEvent | null>(passedEvent ?? null)
  const [loading, setLoading] = useState(!passedEvent)
  const [notFound, setNotFound] = useState(false)

  const [planned, setPlanned] = useState(false)
  const [watchlistId, setWatchlistId] = useState<string | undefined>(undefined)
  const [planBusy, setPlanBusy] = useState(false)

  const [logged, setLogged] = useState(false)
  const [logBusy, setLogBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    if (!passedEvent) setLoading(true)
    fetchEvent(id).then((result) => {
      if (cancelled) return
      if (result) {
        setEvent(result)
      } else if (!passedEvent) {
        setNotFound(true)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
    // Only re-fetch when the route id changes -- passedEvent is a one-time seed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!event) return
    let cancelled = false
    getPlanState(user.id, event).then((state) => {
      if (cancelled) return
      setPlanned(state.planned)
      setWatchlistId(state.watchlistId)
    })
    hasLoggedObservation(user.id, event).then((result) => {
      if (!cancelled) setLogged(result)
    })
    return () => {
      cancelled = true
    }
  }, [event, user.id])

  if (loading) return <p className="ui-empty-state">Loading event…</p>
  if (notFound || !event) {
    return (
      <div className="page">
        <p className="ui-empty-state">Couldn't find that event.</p>
        <Link to="/app/events" className="ui-button">
          Back to Events
        </Link>
      </div>
    )
  }

  const category = categoryFor(event.kind)
  const hasStarted = new Date(event.starts_at).getTime() <= Date.now()

  async function togglePlan() {
    if (!entitled || !event) return
    setPlanBusy(true)
    try {
      if (planned && watchlistId) {
        await removeFromPlan(watchlistId)
        setPlanned(false)
        setWatchlistId(undefined)
      } else {
        const id = await addToPlan(user.id, event)
        setPlanned(true)
        setWatchlistId(id)
      }
    } finally {
      setPlanBusy(false)
    }
  }

  async function handleLog() {
    if (!event) return
    setLogBusy(true)
    try {
      await logObservation(user.id, event)
      setLogged(true)
    } finally {
      setLogBusy(false)
    }
  }

  return (
    <div className="page ui-event-detail">
      <Link to="/app/events" className="ui-back-link">
        ← Events
      </Link>

      {event.image_url && (
        <figure className="ui-event-detail-image">
          <img src={event.image_url} alt="" />
          {event.image_credit && <figcaption>{event.image_credit}</figcaption>}
        </figure>
      )}

      <div className="page-header">
        <span className="ui-feed-kicker">{category.label}</span>
        <h1>{event.title}</h1>
        <p>{formatDateTime(event.starts_at)}</p>
      </div>

      {event.description && <p className="ui-event-detail-description">{event.description}</p>}

      {event.content && (
        <section className="ui-section">
          <h2 className="ui-section-title">How to view it</h2>
          <p>{event.content}</p>
        </section>
      )}

      <div className="ui-event-detail-actions">
        {entitled ? (
          <button type="button" className={`ui-button${planned ? ' ui-button-primary' : ''}`} onClick={togglePlan} disabled={planBusy}>
            {planned ? 'Added to plan' : 'Add to plan'}
          </button>
        ) : (
          <Link to="/app/account" className="ui-button">
            Add to plan with Sky Pass
          </Link>
        )}

        {hasStarted && (
          <button type="button" className="ui-button" onClick={handleLog} disabled={logBusy || logged}>
            {logged ? 'Logged' : 'Log it'}
          </button>
        )}
      </div>
    </div>
  )
}

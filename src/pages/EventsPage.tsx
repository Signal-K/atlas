import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { EventsView } from '../views/mobile/EventsView'
import { EntryDetailView, type EntryDetailActions } from '../views/mobile/EntryDetailView'
import type { EntryDetailSubject } from '../lib/entryDetail'
import type { ObservationDraft } from '../lib/observationDraft'
import type { CurrentLocation } from '../lib/currentLocation'
import { CAMERA_PROFILES, getDefaultDevice } from '../lib/cameraProfiles'

export interface EventsPageProps {
  city: CurrentLocation
  onLogAttempt: (draft: ObservationDraft) => void
}

export function EventsPage({ city, onLogAttempt }: EventsPageProps) {
  const [entryDetail, setEntryDetail] = useState<{ subject: EntryDetailSubject; actions?: EntryDetailActions } | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { eventId } = useParams<{ eventId?: string }>()
  const isDetailRoute = Boolean(eventId)

  useEffect(() => {
    function closeDetail() {
      setEntryDetail(null)
      if (isDetailRoute) navigate('/app/events')
    }
    window.addEventListener('atlas:mobile-home', closeDetail)
    return () => window.removeEventListener('atlas:mobile-home', closeDetail)
  }, [isDetailRoute, navigate])

  useEffect(() => {
    if (isDetailRoute && !entryDetail && !location.state?.entryDetail) navigate('/app/events', { replace: true })
  }, [entryDetail, isDetailRoute, location.state, navigate])

  const detail = entryDetail ?? (location.state?.entryDetail as typeof entryDetail | undefined) ?? null

  function logEntryDetailAttempt() {
    if (!detail) return
    const { subject } = detail
    onLogAttempt({
      eventId: subject.id,
      targetName: subject.title,
      deviceUsed: CAMERA_PROFILES[getDefaultDevice()].name,
      cameraRecipeUsed: subject.recipeKey ?? undefined,
      locationLabel: city.name,
      moonIlluminationPct: subject.moonPct ?? undefined,
      directionLabel: subject.direction?.compassLabel,
    })
    setEntryDetail(null)
    navigate('/app/events')
  }

  return (
    <div className="page">
      <h1 className="sr-only">Events</h1>
      <div className={`mobile-shell${isDetailRoute ? ' events-page-background' : ''}`}>
        <EventsView
          city={city}
          onOpenEntry={(subject, actions) => {
            setEntryDetail({ subject, actions })
            navigate(`/app/events/${encodeURIComponent(subject.id)}`, { state: { entryDetail: { subject, actions } } })
          }}
        />
      </div>

      {isDetailRoute && detail && (
        <div className="event-detail-page">
          <EntryDetailView
            subject={detail.subject}
            actions={detail.actions}
            onClose={() => {
              setEntryDetail(null)
              navigate('/app/events')
            }}
            onLogAttempt={logEntryDetailAttempt}
          />
        </div>
      )}
    </div>
  )
}

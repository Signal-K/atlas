import { useEffect, useState } from 'react'
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

  useEffect(() => {
    function closeDetail() {
      setEntryDetail(null)
    }
    window.addEventListener('atlas:mobile-home', closeDetail)
    return () => window.removeEventListener('atlas:mobile-home', closeDetail)
  }, [])

  function logEntryDetailAttempt() {
    if (!entryDetail) return
    const { subject } = entryDetail
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
  }

  return (
    <div className="page">
      <h1 className="sr-only">Events</h1>
      <div className="mobile-shell">
        <EventsView
          city={city}
          onOpenEntry={(subject, actions) => setEntryDetail({ subject, actions })}
        />
      </div>

      {entryDetail && (
        <div className="mobile-shell dt-entry-overlay">
          <EntryDetailView
            subject={entryDetail.subject}
            actions={entryDetail.actions}
            onClose={() => setEntryDetail(null)}
            onLogAttempt={logEntryDetailAttempt}
          />
        </div>
      )}
    </div>
  )
}

import { Suspense, lazy, useState } from 'react'
import { EventsView } from '../views/mobile/EventsView'
import type { EntryDetailActions } from '../views/mobile/EntryDetailView'
import type { EntryDetailSubject } from '../lib/entryDetail'
import type { ObservationDraft } from '../lib/observationDraft'
import type { CurrentLocation } from '../lib/currentLocation'
import { CAMERA_PROFILES, getDefaultDevice } from '../lib/cameraProfiles'

// EntryDetailView still carries its own (mobile.css-based) styling -- kept
// isolated to this one secondary overlay for now rather than blocking the
// primary Events list on a full reskin. See KES-131 phase 9 follow-up.
const EntryDetailView = lazy(() => import('../views/mobile/EntryDetailView').then((m) => ({ default: m.EntryDetailView })))

export interface EventsPageProps {
  city: CurrentLocation
  onLogAttempt: (draft: ObservationDraft) => void
}

export function EventsPage({ city, onLogAttempt }: EventsPageProps) {
  const [entryDetail, setEntryDetail] = useState<{ subject: EntryDetailSubject; actions?: EntryDetailActions } | null>(null)

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
      <header className="page-header">
        <h1>Events</h1>
        <p>Sky events, calendar, and archive.</p>
      </header>

      <div className="mobile-shell">
        <EventsView
          city={city}
          onOpenEntry={(subject, actions) => setEntryDetail({ subject, actions })}
        />
      </div>

      {entryDetail && (
        <div className="mobile-shell dt-entry-overlay">
          <Suspense fallback={null}>
            <EntryDetailView
              subject={entryDetail.subject}
              actions={entryDetail.actions}
              onClose={() => setEntryDetail(null)}
              onLogAttempt={logEntryDetailAttempt}
            />
          </Suspense>
        </div>
      )}
    </div>
  )
}

import { Suspense, lazy, useState } from 'react'
import { EventsView } from '../views/mobile/EventsView'
import type { EntryDetailActions } from '../views/mobile/EntryDetailView'
import type { EntryDetailSubject } from '../lib/entryDetail'
import type { CurrentLocation } from '../lib/currentLocation'

// EntryDetailView still carries its own (mobile.css-based) styling -- kept
// isolated to this one secondary overlay for now rather than blocking the
// primary Events list on a full reskin. See KES-131 phase 9 follow-up.
const EntryDetailView = lazy(() => import('../views/mobile/EntryDetailView').then((m) => ({ default: m.EntryDetailView })))

export interface EventsPageProps {
  city: CurrentLocation
}

export function EventsPage({ city }: EventsPageProps) {
  const [entryDetail, setEntryDetail] = useState<{ subject: EntryDetailSubject; actions?: EntryDetailActions } | null>(null)

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
              onLogAttempt={() => setEntryDetail(null)}
            />
          </Suspense>
        </div>
      )}
    </div>
  )
}

import { Suspense, lazy, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HubView } from '../views/mobile/HubView'
import type { EntryDetailActions } from '../views/mobile/EntryDetailView'
import type { EntryDetailSubject } from '../lib/entryDetail'
import type { ObservationDraft } from '../lib/observationDraft'
import type { CurrentLocation } from '../lib/currentLocation'
import './dt-shared.css'

const EntryDetailView = lazy(() => import('../views/mobile/EntryDetailView').then((m) => ({ default: m.EntryDetailView })))

type HubTab = 'hub' | 'events' | 'calendar' | 'journal'

export interface DashboardPageProps {
  currentLocation: CurrentLocation
  onLogAttempt: (draft: ObservationDraft) => void
}

// HubView (sky map, tonight plan, week conditions, watchlist, get-ready
// reminders) is today's closest analog to a "Dashboard" -- reused as-is,
// scoped in `.mobile-shell` like Plan/Journal's reused surfaces. Usage-
// weighted section ordering ("gradually learns preferences") is a
// follow-up once there's real interaction data to weight against; this
// phase focuses on getting real content on screen. See KES-131.
export function DashboardPage({ currentLocation, onLogAttempt }: DashboardPageProps) {
  const navigate = useNavigate()
  const [entryDetail, setEntryDetail] = useState<{ subject: EntryDetailSubject; actions?: EntryDetailActions } | null>(null)

  function openTab(tab: HubTab) {
    if (tab === 'events') navigate('/app/events')
    else if (tab === 'calendar') navigate('/app/plan')
    else if (tab === 'journal') navigate('/app/journal')
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Dashboard</h1>
        <p>Tonight's snapshot, next event, and conditions.</p>
      </header>

      <div className="mobile-shell">
        <HubView
          city={currentLocation}
          onOpenTab={openTab}
          onLogAttempt={onLogAttempt}
          onOpenEntry={(subject) => setEntryDetail({ subject })}
          onOpenTonight={() => {}}
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

import { Suspense, lazy, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlanView } from '../views/mobile/PlanView'
import { DarkSkyView } from '../views/DarkSkyView'
import { DeepSkyPlannerView } from '../views/DeepSkyPlannerView'
import type { EntryDetailActions } from '../views/mobile/EntryDetailView'
import type { EntryDetailSubject } from '../lib/entryDetail'
import type { ObservationDraft } from '../lib/observationDraft'
import type { CurrentLocation } from '../lib/currentLocation'
import { CAMERA_PROFILES, getDefaultDevice } from '../lib/cameraProfiles'
import { Tabs } from '../ui/Tabs'
import './dt-shared.css'

// PlanView still carries its own (mobile.css-based) "Daily Transit" styling
// for now -- its calendar/tool-card/watchlist surface is large enough
// (~55 classes) that reskinning it wasn't the fastest path to a working
// Plan area. Scoped to this one tab via `.mobile-shell` rather than
// reintroducing it app-wide. See KES-131 phase 9 follow-up.
const EntryDetailView = lazy(() => import('../views/mobile/EntryDetailView').then((m) => ({ default: m.EntryDetailView })))

export interface PlanPageProps {
  currentLocation: CurrentLocation
  onLogAttempt: (draft: ObservationDraft) => void
}

export function PlanPage({ currentLocation, onLogAttempt }: PlanPageProps) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'workspace' | 'darksky' | 'planner'>('workspace')
  const [entryDetail, setEntryDetail] = useState<{ subject: EntryDetailSubject; actions?: EntryDetailActions } | null>(null)

  function logEntryDetailAttempt() {
    if (!entryDetail) return
    const { subject } = entryDetail
    onLogAttempt({
      eventId: subject.id,
      targetName: subject.title,
      deviceUsed: CAMERA_PROFILES[getDefaultDevice()].name,
      cameraRecipeUsed: subject.recipeKey ?? undefined,
      locationLabel: currentLocation.name,
      moonIlluminationPct: subject.moonPct ?? undefined,
      directionLabel: subject.direction?.compassLabel,
    })
    setEntryDetail(null)
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Plan</h1>
        <p>Trip planning, dark-sky sites, deep-sky targets, and camera presets.</p>
      </header>

      <Tabs
        items={[
          { key: 'workspace', label: 'Plan workspace' },
          { key: 'darksky', label: 'Dark-sky trips' },
          { key: 'planner', label: 'Deep-sky planner' },
        ]}
        active={tab}
        onChange={(key) => setTab(key as typeof tab)}
      />

      {tab === 'workspace' && (
        <div className="mobile-shell">
          <PlanView
            city={currentLocation}
            onOpenEvents={() => navigate('/app/events')}
            onOpenEntry={(subject, actions) => setEntryDetail({ subject, actions })}
          />
        </div>
      )}
      {tab === 'darksky' && <DarkSkyView lat={currentLocation.lat} lon={currentLocation.lon} />}
      {tab === 'planner' && <DeepSkyPlannerView lat={currentLocation.lat} lon={currentLocation.lon} />}

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

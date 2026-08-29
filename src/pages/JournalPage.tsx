import { useState } from 'react'
import { ScrapbookView } from '../views/ScrapbookView'
import { ArchiveView } from '../views/ArchiveView'
import { CommunityView } from '../views/mobile/CommunityView'
import { Tabs } from '../ui/Tabs'
import type { ObservationDraft } from '../lib/observationDraft'
import type { CurrentLocation } from '../lib/currentLocation'

// Journal merges private capture (Scrapbook), objective history (Archive),
// and public sharing + photo challenges (Community/Feed) into one area --
// this is already the intended shape per design.md, previously split
// across separate desktop tabs. The shared headless baseline supplies the
// layout for each view while the behavior-owned components remain unchanged.

type JournalMode = 'private' | 'archive' | 'public'

export interface JournalPageProps {
  draft?: ObservationDraft | null
  onDraftConsumed?: () => void
  currentLocation: CurrentLocation
}

export function JournalPage({ draft = null, onDraftConsumed = () => {}, currentLocation }: JournalPageProps) {
  const [mode, setMode] = useState<JournalMode>('private')

  return (
    <div className="page atlas-journal">
      <header className="page-header atlas-journal-header">
        <h1>Journal</h1>
        <p>Private observations, saved locally first.</p>
      </header>

      <Tabs
        items={[
          { key: 'private', label: 'Private' },
          { key: 'archive', label: 'Archive' },
          { key: 'public', label: 'Public' },
        ]}
        active={mode}
        onChange={(key) => setMode(key as JournalMode)}
      />

      {mode === 'private' && <ScrapbookView draft={draft} onDraftConsumed={onDraftConsumed} currentLocation={currentLocation} />}
      {mode === 'archive' && <ArchiveView />}
      {mode === 'public' && (
        <div className="mobile-shell">
          <CommunityView />
        </div>
      )}
    </div>
  )
}

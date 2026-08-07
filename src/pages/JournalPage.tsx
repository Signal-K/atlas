import { useState } from 'react'
import { ScrapbookView } from '../views/ScrapbookView'
import { ArchiveView } from '../views/ArchiveView'
import { CommunityView } from '../views/mobile/CommunityView'
import { Tabs } from '../ui/Tabs'
import type { ObservationDraft } from '../lib/observationDraft'
import './dt-shared.css'

// Journal merges private capture (Scrapbook), objective history (Archive),
// and public sharing + photo challenges (Community/Feed) into one area --
// this is already the intended shape per design.md, previously split
// across separate desktop tabs. ScrapbookView/ArchiveView render on the
// app's shared design tokens already (global App.css classes); Community
// (Feed + Photo Challenges) still carries its own mobile.css-based
// styling, scoped locally via `.mobile-shell` rather than fully reskinned
// -- same trade as Plan's workspace tab. See KES-131 phase 9 follow-up.

type JournalMode = 'private' | 'archive' | 'public'

export interface JournalPageProps {
  draft?: ObservationDraft | null
  onDraftConsumed?: () => void
}

export function JournalPage({ draft = null, onDraftConsumed = () => {} }: JournalPageProps) {
  const [mode, setMode] = useState<JournalMode>('private')

  return (
    <div className="page">
      <header className="page-header">
        <h1>Journal</h1>
        <p>Private capture, archive, sharing, city stamps, and photo challenges.</p>
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

      {mode === 'private' && <ScrapbookView draft={draft} onDraftConsumed={onDraftConsumed} />}
      {mode === 'archive' && <ArchiveView />}
      {mode === 'public' && (
        <div className="mobile-shell">
          <CommunityView />
        </div>
      )}
    </div>
  )
}

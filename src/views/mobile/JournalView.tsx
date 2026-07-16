import { useState, type ReactNode } from 'react'
import { ArchiveView } from '../ArchiveView'
import { ScrapbookView } from '../ScrapbookView'
import { CommunityView } from './CommunityView'
import type { ObservationDraft } from '../../lib/observationDraft'

type JournalMode = 'private' | 'archive' | 'public'

const MODES: Array<{ id: JournalMode; label: string }> = [
  { id: 'private', label: 'Private' },
  { id: 'archive', label: 'Archive' },
  { id: 'public', label: 'Public' },
]

export function JournalView({
  draft,
  onDraftConsumed,
}: {
  draft: ObservationDraft | null
  onDraftConsumed: () => void
}) {
  const [mode, setMode] = useState<JournalMode>('private')

  const content: Record<JournalMode, ReactNode> = {
    private: <ScrapbookView draft={draft} onDraftConsumed={onDraftConsumed} />,
    archive: <ArchiveView />,
    public: <CommunityView />,
  }

  return (
    <div className="mobile-journal">
      <section className="mobile-card mobile-community-switcher">
        <div className="mobile-card-header">
          <div>
            <div className="mobile-card-eyebrow">Journal</div>
            <h2>Private and public sky log</h2>
          </div>
        </div>
        <div className="mobile-community-tabs" aria-label="Journal sections">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={mode === item.id ? 'is-active' : ''}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>
      <div className="mobile-community-panel">{content[mode]}</div>
    </div>
  )
}

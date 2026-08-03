import { useState } from 'react'
import '../../mobile.css'
import { CameraRecipe } from '../../components/CameraRecipe'
import { BackIcon, MobileIcon } from '../../components/mobile/MobileIcon'
import { formatTimeLabel, type EntryDetailSubject } from '../../lib/entryDetail'

export interface EntryDetailActions {
  watching?: boolean
  onToggleWatch?: () => void
  reminderActive?: boolean
  onRemind?: () => void
  onPoint?: () => void
}

interface EntryDetailViewProps {
  subject: EntryDetailSubject
  actions?: EntryDetailActions
  onClose: () => void
  onLogAttempt: () => void
}

// One shared full-screen "inspect this" page for Hub, Visible Tonight,
// Events, and Plan (STS: Atlas Tonight & Feed Redesign) -- replaces Hub's
// inline expand-in-place and Events/Plan's bottom sheet with a single,
// consistent page so the three surfaces can't drift into different-looking
// detail screens again.
export function EntryDetailView({ subject, actions, onClose, onLogAttempt }: EntryDetailViewProps) {
  const [recipeOpen, setRecipeOpen] = useState(false)
  const duskLabel = formatTimeLabel(subject.darknessWindow.astronomicalDuskAt ?? subject.darknessWindow.civilDuskAt)
  const dawnLabel = formatTimeLabel(subject.darknessWindow.astronomicalDawnAt ?? subject.darknessWindow.civilDawnAt)

  return (
    <div className="dt-entry">
      <div className="dt-entry-rule" style={{ background: subject.accent }} />
      <div className="dt-entry-scroll">
        <button type="button" className="dt-entry-back" onClick={onClose}>
          <BackIcon />
          <span>Back</span>
        </button>

        <div className="dt-entry-head">
          <span className="dt-entry-swatch" style={{ background: subject.swatch }} />
          <div>
            <h2 className="dt-entry-title">{subject.title}</h2>
            <div className="dt-entry-subtitle">
              {subject.subtitleLine}
              {subject.isGuide && <span className="dt-feed-guide-tag">GUIDE</span>}
            </div>
          </div>
        </div>

        <div className="dt-entry-facts">
          <div>
            <span>Best time</span>
            <strong>{subject.bestTimeLabel}</strong>
          </div>
          <div>
            <span>Direction</span>
            <strong>{subject.direction ? `${subject.direction.compassLabel}, ${Math.round(subject.direction.altitudeDeg)}°` : '—'}</strong>
          </div>
          <div>
            <span>Moon</span>
            <strong>{subject.moonPct != null ? `${Math.round(subject.moonPct)}%` : '—'}</strong>
          </div>
        </div>

        <section className="dt-entry-section">
          <div className="dt-section-eyebrow">Camera suitability</div>
          <div className="dt-entry-pills">
            {subject.suitability.map((pill) => (
              <span key={pill.label} className={`dt-entry-pill${pill.active ? ' is-active' : ''}`}>
                {pill.label}
              </span>
            ))}
          </div>
          <p className="dt-entry-note">{subject.suitabilityNote}</p>
        </section>

        <section className="dt-entry-section">
          <div className="dt-section-eyebrow">Why look tonight</div>
          <p className="dt-entry-body">{subject.why}</p>
        </section>

        <section className="dt-entry-section">
          <div className="dt-section-eyebrow">Best time tonight</div>
          <div className="dt-entry-timeline">
            <span className="dt-entry-timeline-marker" style={{ left: `${subject.markerPct}%`, background: subject.accent }} />
          </div>
          <div className="dt-entry-timeline-labels">
            <span>Dusk {duskLabel}</span>
            <span>Dawn {dawnLabel}</span>
          </div>
        </section>

        <section className="dt-entry-section dt-entry-weather">
          <div className="dt-section-eyebrow">Weather check</div>
          <p className="dt-entry-body">{subject.cloudNote}</p>
        </section>

        {recipeOpen && (
          <section className="dt-entry-recipe">
            <div className="dt-section-eyebrow">Suggested settings</div>
            {subject.recipeKey ? (
              <CameraRecipe recipeKey={subject.recipeKey} />
            ) : (
              <p className="dt-entry-body">No camera recipe for this target yet — naked-eye or binoculars is the way to go.</p>
            )}
          </section>
        )}

        {actions && (actions.onToggleWatch || actions.onRemind || actions.onPoint) && (
          <div className="dt-entry-quick-actions">
            {actions.onToggleWatch && (
              <button type="button" className={`dt-entry-quick-action${actions.watching ? ' is-active' : ''}`} onClick={actions.onToggleWatch}>
                <MobileIcon name="pin" />
                <span>{actions.watching ? 'Watching' : 'Watch'}</span>
              </button>
            )}
            {actions.onRemind && (
              <button type="button" className={`dt-entry-quick-action${actions.reminderActive ? ' is-active' : ''}`} onClick={actions.onRemind}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span>Remind</span>
              </button>
            )}
            {actions.onPoint && (
              <button type="button" className="dt-entry-quick-action" onClick={actions.onPoint}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="m16 8-5 3-1 5 5-3Z" />
                </svg>
                <span>Point</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="dt-entry-actions">
        <button type="button" className="dt-entry-recipe-toggle" onClick={() => setRecipeOpen((current) => !current)}>
          {recipeOpen ? 'Hide camera recipe' : 'Camera recipe'}
        </button>
        <button type="button" className="dt-entry-log" onClick={onLogAttempt}>
          Log attempt
        </button>
      </div>
    </div>
  )
}

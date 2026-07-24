import { useEffect, useRef, useState } from 'react'
import { KIND_LABELS } from '../../widgets/EventRow'
import { CameraRecipe } from '../CameraRecipe'
import { categoryForKind, GUIDE_KIND_IDS } from '../../lib/eventCategories'
import type { RecipeKey } from '../../lib/cameraRecipes'
import type { SkyEvent } from '../../lib/db'
import { MobileIcon } from './MobileIcon'
interface ConditionSummary {
  moonPct: number
  cloudPct: number | null
  rainPct: number | null
}

interface PointAction {
  onPoint: () => void
}

// Shared event-detail bottom sheet for both Plan and Events -- pulls up
// over whatever list is behind it (backdrop + drag handle + swipe/tap to
// dismiss) instead of replacing the whole screen, matching the Claude
// Design mock. Both surfaces render this exact component so they can't
// drift into different-looking detail screens again.
export function EventDetailPanel({
  event,
  onClose,
  bestViewingLabel,
  relevance,
  conditions,
  forecastUnavailableHint,
  watching,
  onToggleWatch,
  reminderActive,
  onRemind,
  point,
  onLogAttempt,
  recipeKey,
}: {
  event: SkyEvent
  onClose: () => void
  bestViewingLabel: string
  relevance: 'local' | 'global'
  conditions: ConditionSummary | null
  forecastUnavailableHint?: string
  watching: boolean
  onToggleWatch: () => void
  reminderActive: boolean
  onRemind: () => void
  point?: PointAction
  onLogAttempt: () => void
  recipeKey: RecipeKey | null
}) {
  const [setupOpen, setSetupOpen] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const dragStartY = useRef(0)
  const category = categoryForKind(event.kind)

  useEffect(() => {
    setImageFailed(false)
  }, [event.id])

  function onHandleDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStartY.current = e.clientY
    setDragging(true)
  }

  function onHandleMove(e: React.PointerEvent) {
    if (!dragging) return
    setDragY(Math.max(0, e.clientY - dragStartY.current))
  }

  function onHandleUp() {
    if (dragY > 90) onClose()
    setDragging(false)
    setDragY(0)
  }

  return (
    <>
      <div className="mobile-sheet-backdrop" onClick={onClose} />
      <div
        className="mobile-sheet"
        style={{ transform: `translateY(${dragY}px)`, transition: dragging ? 'none' : undefined }}
      >
        <div
          className="mobile-sheet-handle"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
        >
          <span />
        </div>

        <div className="mobile-sheet-hero" style={category ? { borderColor: category.accent } : undefined}>
          {event.imageUrl && !imageFailed ? (
            <img src={event.imageUrl} alt="" loading="lazy" onError={() => setImageFailed(true)} />
          ) : (
            <span className="mobile-sheet-hero-fallback" style={category ? { color: category.accent } : undefined}>
              <MobileIcon name={category?.icon ?? 'zap'} />
            </span>
          )}
        </div>

        <div className="mobile-sheet-head">
          <div>
            <span className="mobile-event-kind" style={category ? { color: category.accent } : undefined}>
              {KIND_LABELS[event.kind] ?? event.kind}
              {GUIDE_KIND_IDS.has(event.kind) && <span className="dt-feed-guide-tag">GUIDE</span>}
            </span>
            <h2>{event.title}</h2>
          </div>
          <button type="button" className="mobile-sheet-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M5 5l10 10M15 5 5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="mobile-sheet-facts">
          <div>
            <span>Best viewing</span>
            <strong>{bestViewingLabel}</strong>
          </div>
          <div>
            <span>Relevance</span>
            <strong className="mobile-sheet-relevance">{relevance === 'local' ? 'Local' : 'Global'}</strong>
          </div>
        </div>

        <p className="mobile-event-notes">{event.content ?? event.description}</p>

        {conditions && (
          <div className="mobile-condition-bars">
            <div className="mobile-condition-bar">
              <span>Moon</span>
              <div className="mobile-condition-track">
                <div className="mobile-condition-fill" style={{ width: `${Math.round(conditions.moonPct)}%` }} />
              </div>
              <strong>{Math.round(conditions.moonPct)}%</strong>
            </div>
            {conditions.cloudPct != null && (
              <div className="mobile-condition-bar">
                <span>Cloud</span>
                <div className="mobile-condition-track">
                  <div className="mobile-condition-fill" style={{ width: `${Math.round(conditions.cloudPct)}%` }} />
                </div>
                <strong>{Math.round(conditions.cloudPct)}%</strong>
              </div>
            )}
            {conditions.rainPct != null && (
              <div className="mobile-condition-bar">
                <span>Rain</span>
                <div className="mobile-condition-track">
                  <div className="mobile-condition-fill" style={{ width: `${Math.round(conditions.rainPct)}%` }} />
                </div>
                <strong>{Math.round(conditions.rainPct)}%</strong>
              </div>
            )}
          </div>
        )}
        {conditions?.cloudPct == null && conditions?.rainPct == null && forecastUnavailableHint && (
          <p className="mobile-empty-hint">{forecastUnavailableHint}</p>
        )}

        <div className="mobile-sheet-actions">
          <button type="button" className={`mobile-sheet-action${watching ? ' is-active' : ''}`} onClick={onToggleWatch}>
            <MobileIcon name="pin" />
            <span>{watching ? 'Watching' : 'Watch'}</span>
          </button>
          <button type="button" className={`mobile-sheet-action${reminderActive ? ' is-active' : ''}`} onClick={onRemind}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span>Remind</span>
          </button>
          {point && (
            <button type="button" className="mobile-sheet-action" onClick={point.onPoint}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="m16 8-5 3-1 5 5-3Z" />
              </svg>
              <span>Point</span>
            </button>
          )}
          <button type="button" className="mobile-sheet-action" onClick={onLogAttempt}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            <span>Log</span>
          </button>
        </div>

        {recipeKey ? (
          <>
            <button type="button" className="mobile-sheet-setup-toggle" onClick={() => setSetupOpen((current) => !current)}>
              {setupOpen ? 'Hide phone setup' : 'Show phone setup'}
              <MobileIcon name="chevron" />
            </button>
            {setupOpen && <CameraRecipe recipeKey={recipeKey} />}
          </>
        ) : (
          <p className="mobile-empty-hint">No camera recipe yet for this event type.</p>
        )}
      </div>
    </>
  )
}

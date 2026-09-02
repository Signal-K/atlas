import { useEffect, useState } from 'react'
import { CameraRecipe } from '../../components/CameraRecipe'
import { MobileIcon } from '../../components/mobile/MobileIcon'
import { Starfield } from '../../components/mobile/Starfield'
import { StatGrid } from '../../components/mobile/StatGrid'
import type { EntryDetailSubject } from '../../lib/entryDetail'

export interface EntryDetailRoadmap {
  // true when this is a Sky Pass-only feature and the viewer isn't entitled
  // -- rendered as an upsell hint instead of the generate button.
  locked: boolean
  // Present only when unlocked; builds a personalized viewing plan for this
  // event at the viewer's current location/time via the Claude-backed
  // pocketbase/pb_hooks/eclipse-roadmap.pb.js endpoint.
  generate?: () => Promise<string>
}

// What a quick-action click resolved to, so this overlay can show its own
// confirmation/paywall feedback instead of relying on a status line that
// lives behind it.
export interface QuickActionOutcome {
  message?: string
  watching?: boolean
  reminderActive?: boolean
  tagged?: boolean
}

export interface EntryDetailActions {
  watching?: boolean
  onToggleWatch?: () => Promise<QuickActionOutcome | void>
  reminderActive?: boolean
  onRemind?: () => Promise<QuickActionOutcome | void>
  onPoint?: () => void
  roadmap?: EntryDetailRoadmap
  // Per-event bookmark (feed's "Tagged only" filter), distinct from
  // onToggleWatch's kind/target-level watch. Tagging also arms a get-ready
  // reminder for this event -- see EventsView's onToggleTag.
  tagged?: boolean
  onToggleTag?: () => Promise<QuickActionOutcome | void>
  // Adds this event to the active trip leg covering its date (if any),
  // arming a watch + reminder in the process. Undefined hides the button --
  // not every caller has trip context to wire it with.
  onAddToItinerary?: () => Promise<QuickActionOutcome | void>
}

interface EntryDetailViewProps {
  subject: EntryDetailSubject
  actions?: EntryDetailActions
  onClose: () => void
  onLogAttempt: () => void
  dark?: boolean
}

function stepsFor(subject: EntryDetailSubject): Array<{ n: string; text: string }> {
  if (subject.guideSteps && subject.guideSteps.length > 0) {
    return subject.guideSteps.map((step, i) => ({ n: String(i + 1).padStart(2, '0'), text: `${step.label} — ${step.detail}` }))
  }
  const steps: string[] = []
  if (subject.bestTimeLabel && subject.bestTimeLabel !== '—') steps.push(`Be outside around ${subject.bestTimeLabel}.`)
  steps.push(subject.suitabilityNote)
  if (subject.why) steps.push(subject.why)
  steps.push(subject.cloudNote)
  return steps.map((text, i) => ({ n: String(i + 1).padStart(2, '0'), text }))
}

// One shared full-screen "inspect this" overlay for Hub, Events, and the
// Search overlay -- the Atlas Mobile mockup's Event Detail screen: hero
// media, kind + title + blurb, a 4-stat grid, numbered "How to catch it"
// steps, a camera recipe row, and watch/remind/itinerary/log-attempt
// actions.
export function EntryDetailView({ subject, actions, onClose, onLogAttempt, dark = false }: EntryDetailViewProps) {
  const [recipeOpen, setRecipeOpen] = useState(false)
  const [roadmapLoading, setRoadmapLoading] = useState(false)
  const [roadmapText, setRoadmapText] = useState<string | null>(null)
  const [roadmapError, setRoadmapError] = useState<string | null>(null)
  const [watching, setWatching] = useState(actions?.watching ?? false)
  const [reminderActive, setReminderActive] = useState(actions?.reminderActive ?? false)
  const [tagged, setTagged] = useState(actions?.tagged ?? false)
  const [quickActionMessage, setQuickActionMessage] = useState<string | null>(null)

  useEffect(() => {
    setWatching(actions?.watching ?? false)
    setReminderActive(actions?.reminderActive ?? false)
    setTagged(actions?.tagged ?? false)
    setQuickActionMessage(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject.id])

  const dateLabel = subject.bestTimeIso
    ? new Date(subject.bestTimeIso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    : null
  const cloudPct = subject.cloudNote.match(/(\d+)%/)?.[1]

  async function handleToggleWatch() {
    if (!actions?.onToggleWatch) return
    const outcome = await actions.onToggleWatch()
    if (outcome?.watching !== undefined) setWatching(outcome.watching)
    setQuickActionMessage(outcome?.message ?? null)
  }

  async function handleRemind() {
    if (!actions?.onRemind) return
    const outcome = await actions.onRemind()
    if (outcome?.reminderActive !== undefined) setReminderActive(outcome.reminderActive)
    setQuickActionMessage(outcome?.message ?? null)
  }

  async function handleToggleTag() {
    if (!actions?.onToggleTag) return
    const outcome = await actions.onToggleTag()
    if (outcome?.tagged !== undefined) setTagged(outcome.tagged)
    setQuickActionMessage(outcome?.message ?? null)
  }

  async function handleAddToItinerary() {
    if (!actions?.onAddToItinerary) return
    const outcome = await actions.onAddToItinerary()
    setQuickActionMessage(outcome?.message ?? null)
  }

  async function handleGenerateRoadmap() {
    if (!actions?.roadmap?.generate) return
    setRoadmapLoading(true)
    setRoadmapError(null)
    try {
      setRoadmapText(await actions.roadmap.generate())
    } catch (err) {
      setRoadmapError(err instanceof Error ? err.message : 'Could not generate a viewing plan.')
    } finally {
      setRoadmapLoading(false)
    }
  }

  return (
    <div className="az-overlay">
      <div className="az-overlay-bg">
        <Starfield dark={dark} />
      </div>
      <div className="az-overlay-header">
        <button type="button" className="az-back-btn" onClick={onClose}>
          <MobileIcon name="back" size={16} />
          Back
        </button>
      </div>
      <div className="az-overlay-body">
        <div className="az-hero-media">EVENT IMAGERY</div>
        <span className="az-kicker" style={{ display: 'block', margin: '0.875rem 0 0', color: 'var(--az-violet-strong)' }}>
          {subject.subtitleLine}
          {subject.isGuide && <span className="az-badge-guide" style={{ marginLeft: '0.375rem' }}>GUIDE</span>}
        </span>
        <h1 style={{ margin: '0.3125rem 0 0.375rem', fontFamily: 'var(--az-font-display)', fontWeight: 700, fontSize: '1.75rem', lineHeight: 1.1 }}>
          {subject.title}
        </h1>
        <p className="az-muted" style={{ margin: 0, fontSize: '0.875rem' }}>
          {dateLabel && <>{dateLabel} · </>}
          {subject.why}
        </p>

        <div style={{ marginTop: '1rem' }}>
          <StatGrid
            stats={[
              { value: subject.bestTimeLabel, label: 'BEST TIME' },
              { value: subject.direction ? `${Math.round(subject.direction.altitudeDeg)}°` : '—', label: 'PEAK ALT' },
              { value: subject.direction?.compassLabel ?? '—', label: 'LOOK' },
              { value: cloudPct ? `${cloudPct}%` : '—', label: 'CLOUD' },
            ]}
          />
        </div>

        <div className="az-section-head">
          <span className="az-kicker">Camera suitability</span>
        </div>
        <div className="az-chip-row">
          {subject.suitability.map((pill) => (
            <span key={pill.label} className={`az-chip${pill.active ? ' is-active' : ''}`} style={{ cursor: 'default' }}>
              {pill.label}
            </span>
          ))}
        </div>
        <p className="az-muted" style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem' }}>
          {subject.suitabilityNote}
        </p>

        <div className="az-section-head">
          <span className="az-kicker">How to catch it</span>
        </div>
        <div className="az-row-group">
          {stepsFor(subject).map((step) => (
            <div key={step.n} className="az-row" style={{ cursor: 'default', alignItems: 'flex-start' }}>
              <span className="az-row-icon" style={{ borderRadius: '50%', fontFamily: 'var(--az-font-mono)', fontSize: '0.6875rem', fontWeight: 500 }}>
                {step.n}
              </span>
              <span style={{ fontSize: '0.84375rem', lineHeight: 1.5 }}>{step.text}</span>
            </div>
          ))}
        </div>

        {actions?.roadmap && (
          <>
            <div className="az-section-head">
              <span className="az-kicker">Personalized viewing plan</span>
            </div>
            {actions.roadmap.locked ? (
              <p className="az-muted" style={{ fontSize: '0.8125rem' }}>
                Sky Pass unlocks a step-by-step plan built from your exact location and this event's local timing.
              </p>
            ) : (
              <>
                <button type="button" className="az-btn az-btn-outline az-btn-block" onClick={handleGenerateRoadmap} disabled={roadmapLoading}>
                  {roadmapLoading ? 'Generating…' : roadmapText ? 'Regenerate plan' : 'Generate my viewing plan'}
                </button>
                {roadmapError && <p style={{ color: 'var(--az-flagship)', fontSize: '0.8125rem' }}>{roadmapError}</p>}
                {roadmapText && <p style={{ fontSize: '0.875rem' }}>{roadmapText}</p>}
              </>
            )}
          </>
        )}

        <button
          type="button"
          className="az-row"
          style={{ marginTop: '0.75rem', borderRadius: '0.875rem', border: '1px solid var(--line)' }}
          onClick={() => setRecipeOpen((current) => !current)}
        >
          <span className="az-row-icon" style={{ color: 'var(--az-amber)' }}>
            <MobileIcon name="camera" />
          </span>
          <span className="az-row-main">
            <span className="az-row-title">{recipeOpen ? 'Hide camera recipe' : 'Camera recipe'}</span>
            <span className="az-row-value">{subject.recipeKey ? 'Suggested phone/telescope settings' : 'Naked eye or binoculars is the way to go'}</span>
          </span>
          <span className="az-row-chevron">
            <MobileIcon name="chevron" size={14} />
          </span>
        </button>
        {recipeOpen && (
          <div style={{ marginTop: '0.625rem' }}>{subject.recipeKey ? <CameraRecipe recipeKey={subject.recipeKey} /> : null}</div>
        )}

        {actions?.onToggleTag && (
          <button type="button" className={`az-chip${tagged ? ' is-active' : ''}`} style={{ marginTop: '0.75rem' }} onClick={handleToggleTag}>
            <MobileIcon name={tagged ? 'check' : 'plus'} size={13} />
            {tagged ? 'Tagged' : 'Tag for my feed'}
          </button>
        )}

        {(actions?.onToggleWatch || actions?.onRemind) && (
          <div className="az-btn-grid-2" style={{ marginTop: '0.875rem' }}>
            {actions?.onToggleWatch && (
              <button type="button" className={`az-btn ${watching ? 'az-btn-positive' : 'az-btn-primary'}`} onClick={handleToggleWatch}>
                {watching ? 'Watching ✓' : 'Watch'}
              </button>
            )}
            {actions?.onRemind && (
              <button type="button" className={`az-btn ${reminderActive ? 'az-btn-info' : 'az-btn-outline'}`} onClick={handleRemind}>
                {reminderActive ? 'Reminder armed' : 'Remind me'}
              </button>
            )}
          </div>
        )}
        <div className="az-btn-grid-2" style={{ marginTop: '0.5rem' }}>
          {actions?.onAddToItinerary && (
            <button type="button" className="az-btn az-btn-outline" onClick={handleAddToItinerary}>
              Add to itinerary
            </button>
          )}
          <button type="button" className="az-btn az-btn-outline" onClick={onLogAttempt}>
            Log attempt
          </button>
        </div>
        {quickActionMessage && (
          <p className="az-muted" style={{ marginTop: '0.625rem', fontSize: '0.8125rem' }}>
            {quickActionMessage}
          </p>
        )}
      </div>
    </div>
  )
}

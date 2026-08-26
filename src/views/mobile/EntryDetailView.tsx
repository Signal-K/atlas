import { useEffect, useState } from 'react'
import '../../mobile.css'
import { CameraRecipe } from '../../components/CameraRecipe'
import { BackIcon, MobileIcon } from '../../components/mobile/MobileIcon'
import { formatTimeLabel, type EntryDetailSubject } from '../../lib/entryDetail'

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
// lives in the underlying EventsView/PlanView -- that line is rendered
// behind this full-screen overlay (z-index 200 vs the overlay's own stack),
// so a click here previously produced zero visible feedback either way,
// success or Sky Pass block (KES-179).
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
  const [instrument, setInstrument] = useState<'phone' | 'telescope'>(() =>
    subject.suitability.find((pill) => pill.label === 'Phone')?.active ? 'phone' : 'telescope',
  )
  const [recipeOpen, setRecipeOpen] = useState(false)
  const [roadmapLoading, setRoadmapLoading] = useState(false)
  const [roadmapText, setRoadmapText] = useState<string | null>(null)
  const [roadmapError, setRoadmapError] = useState<string | null>(null)
  // Local, optimistic mirrors of actions.watching/reminderActive -- the
  // props are a snapshot taken when this event was opened, so they go
  // stale the moment the underlying toggle succeeds (KES-179). Re-seed from
  // props whenever a different event is opened.
  const [watching, setWatching] = useState(actions?.watching ?? false)
  const [reminderActive, setReminderActive] = useState(actions?.reminderActive ?? false)
  const [tagged, setTagged] = useState(actions?.tagged ?? false)
  const [quickActionMessage, setQuickActionMessage] = useState<string | null>(null)
  useEffect(() => {
    setInstrument(subject.suitability.find((pill) => pill.label === 'Phone')?.active ? 'phone' : 'telescope')
    setWatching(actions?.watching ?? false)
    setReminderActive(actions?.reminderActive ?? false)
    setTagged(actions?.tagged ?? false)
    setQuickActionMessage(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject.id])
  const phoneSupported = subject.suitability.find((pill) => pill.label === 'Phone')?.active ?? false
  const instrumentNote = instrument === 'phone'
    ? phoneSupported
      ? `Phone plan: use a stable surface or tripod, focus on ${subject.title}, and use Night mode or a longer exposure if available.`
      : `Phone plan: use a tripod and the longest exposure available, but expect ${subject.title} to be difficult to resolve without more light or optics.`
    : `Telescope plan: start with the lowest-power eyepiece, centre ${subject.title}, then increase magnification only once it is steady and well focused.`
  const duskLabel = formatTimeLabel(subject.darknessWindow.astronomicalDuskAt ?? subject.darknessWindow.civilDuskAt)
  const dawnLabel = formatTimeLabel(subject.darknessWindow.astronomicalDawnAt ?? subject.darknessWindow.civilDawnAt)
  // The category/difficulty subtitle line (e.g. "Eclipse · Moderate ·
  // Phone-friendly") never said *when* -- the only date anywhere on this
  // page was buried mid-sentence in the "Why look tonight" body copy. Events
  // browsed from Events/Plan are routinely days or weeks out, so surface it
  // up front next to the title instead.
  const dateLabel = subject.bestTimeIso
    ? new Date(subject.bestTimeIso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    : null

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

  async function handleGenerateRoadmap() {
    if (!actions?.roadmap?.generate) return
    setRoadmapLoading(true)
    setRoadmapError(null)
    try {
      const roadmap = await actions.roadmap.generate()
      setRoadmapText(roadmap)
    } catch (err) {
      setRoadmapError(err instanceof Error ? err.message : 'Could not generate a viewing plan.')
    } finally {
      setRoadmapLoading(false)
    }
  }

  return (
    <div className="dt-entry atlas-entry-detail">
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
              {dateLabel && (
                <>
                  <span className="dt-entry-date">{dateLabel}</span>
                  <span aria-hidden="true">·</span>
                </>
              )}
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
          <div className="dt-entry-instrument-choice" role="group" aria-label="Choose your equipment">
            <button type="button" className={instrument === 'phone' ? 'is-selected' : ''} aria-pressed={instrument === 'phone'} onClick={() => setInstrument('phone')}>
              Phone
            </button>
            <button type="button" className={instrument === 'telescope' ? 'is-selected' : ''} aria-pressed={instrument === 'telescope'} onClick={() => setInstrument('telescope')}>
              Telescope
            </button>
          </div>
          <p className="dt-entry-instrument-note">{instrumentNote}</p>
        </section>

        <section className="dt-entry-section">
          <div className="dt-section-eyebrow">Why look tonight</div>
          <p className="dt-entry-body">{subject.why}</p>
        </section>

        {/* The dusk/dawn night-sky window is meaningless (and actively
            misleading -- see a daytime solar eclipse showing "dusk 11pm")
            for anything with its own real timeline below; skip straight to
            that instead of showing both. */}
        {(!subject.guideSteps || subject.guideSteps.length === 0) && (
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
        )}

        <section className="dt-entry-section dt-entry-weather">
          <div className="dt-section-eyebrow">Weather check</div>
          <p className="dt-entry-body">{subject.cloudNote}</p>
        </section>

        {subject.guideSteps && subject.guideSteps.length > 0 && (
          <section className="dt-entry-section dt-entry-guide">
            <div className="dt-section-eyebrow">Full timeline</div>
            <ol className="dt-entry-guide-list">
              {subject.guideSteps.map((step, index) => (
                <li key={`${step.label}-${index}`}>
                  <span className="dt-entry-guide-label">{step.label}</span>
                  <span className="dt-entry-guide-detail">{step.detail}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {actions?.roadmap && (
          <section className="dt-entry-section dt-entry-roadmap">
            <div className="dt-section-eyebrow">Personalized viewing plan</div>
            {actions.roadmap.locked ? (
              <p className="dt-entry-note">
                Sky Pass unlocks a step-by-step plan built from your exact location and this eclipse's local timing.
              </p>
            ) : (
              <>
                <button type="button" className="dt-entry-roadmap-generate" onClick={handleGenerateRoadmap} disabled={roadmapLoading}>
                  {roadmapLoading ? 'Generating…' : roadmapText ? 'Regenerate plan' : 'Generate my viewing plan'}
                </button>
                {roadmapError && <p className="dt-entry-note dt-entry-roadmap-error">{roadmapError}</p>}
                {roadmapText && <p className="dt-entry-body dt-entry-roadmap-text">{roadmapText}</p>}
              </>
            )}
          </section>
        )}

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

        {actions && (actions.onToggleWatch || actions.onRemind || actions.onPoint || actions.onToggleTag) && (
          <>
            <div className="dt-entry-quick-actions">
              {actions.onToggleTag && (
                <button type="button" className={`dt-entry-quick-action${tagged ? ' is-active' : ''}`} onClick={handleToggleTag}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24H4a1 1 0 0 0-1 1v5.59a2 2 0 0 0 .59 1.41l9.58 9.58a2 2 0 0 0 2.83 0l4.59-4.59a2 2 0 0 0 0-2.82Z" />
                    <circle cx="7.5" cy="7.5" r="1" fill="currentColor" />
                  </svg>
                  <span>{tagged ? 'Tagged' : 'Tag'}</span>
                </button>
              )}
              {actions.onToggleWatch && (
                <button type="button" className={`dt-entry-quick-action${watching ? ' is-active' : ''}`} onClick={handleToggleWatch}>
                  <MobileIcon name="pin" />
                  <span>{watching ? 'Watching' : 'Watch'}</span>
                </button>
              )}
              {actions.onRemind && (
                <button type="button" className={`dt-entry-quick-action${reminderActive ? ' is-active' : ''}`} onClick={handleRemind}>
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
            {quickActionMessage && <p className="dt-entry-quick-status">{quickActionMessage}</p>}
          </>
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

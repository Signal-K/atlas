import { useEffect, useMemo, useState } from 'react'
import { trackEvent } from '../lib/analytics'
import { useAuth } from '../lib/auth'

type FeedbackMode = 'nps' | 'micro' | 'feature' | null

interface AnalyticsEventDetail {
  name: string
  properties?: Record<string, unknown>
}

const ACTIVITY_KEY = 'atlas-feedback-activity-count'
const NPS_STATE_KEY = 'atlas-feedback-nps-state'
const NPS_DISMISSED_KEY = 'atlas-feedback-nps-dismissed-at'
const MICRO_STATE_KEY = 'atlas-feedback-micro-state'
const ACTIVITY_THRESHOLD = 4
const DISMISS_COOLDOWN_DAYS = 30

const MEANINGFUL_EVENTS = new Set([
  'Tapped visible target',
  'Answered equipment prompt',
  'Generated first plan',
  'Scheduled viewing reminder',
  'Submitted reminder feedback',
  'Logged observation attempt',
  'Sign up completed',
  'Paywall checkout clicked',
])

const MICRO_SURVEY_TRIGGERS: Record<string, { id: string; question: string; options: string[] }> = {
  'Submitted reminder feedback': {
    id: 'reminder_feedback_helpfulness',
    question: 'Was that reminder/check-in useful?',
    options: ['Yes', 'Somewhat', 'No'],
  },
  'Tapped visible target': {
    id: 'target_detail_clarity',
    question: 'Did this help you decide what to look for?',
    options: ['Yes', 'Not sure', 'No'],
  },
}

function compactRecord(record: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value != null && value !== ''))
}

function cleanText(value: string | null | undefined, maxLength = 120): string | undefined {
  const text = value?.replace(/\s+/g, ' ').trim()
  if (!text) return undefined
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

function isVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect()
  const style = window.getComputedStyle(element)
  return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
}

function collectVisibleText(selector: string, limit: number): string[] {
  return Array.from(document.querySelectorAll(selector))
    .filter(isVisible)
    .map((element) => cleanText(element.textContent))
    .filter((text): text is string => Boolean(text))
    .slice(0, limit)
}

function collectFeatureRequestContext() {
  const activePrimaryNav = document.querySelector('[aria-current="true"]')?.getAttribute('aria-label')
  const activeTabs = collectVisibleText('[role="tab"][aria-selected="true"]', 4)
  const visibleHeadings = collectVisibleText('main h1, main h2, main h3, .mobile-content h1, .mobile-content h2, .mobile-content h3', 6)
  const visibleSections = collectVisibleText(
    '.dashboard-subtitle, .mobile-profile-kicker, .dt-brand-subtitle, .settings-status, .paywall-copy strong',
    6,
  )

  return compactRecord({
    currentUrl: window.location.href,
    path: window.location.pathname,
    route: window.location.pathname,
    pageTitle: cleanText(document.title),
    activePrimaryNav: cleanText(activePrimaryNav),
    activeTabs,
    visibleHeadings,
    visibleSections,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  })
}

function readNumber(key: string): number {
  const value = Number(localStorage.getItem(key))
  return Number.isFinite(value) ? value : 0
}

function daysSince(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return Number.POSITIVE_INFINITY
  return (Date.now() - then) / 86_400_000
}

export function FeedbackDock() {
  const { user } = useAuth()
  const [mode, setMode] = useState<FeedbackMode>(null)
  const [activityCount, setActivityCount] = useState(() => readNumber(ACTIVITY_KEY))
  const [npsTrigger, setNpsTrigger] = useState<string | null>(null)
  const [npsScore, setNpsScore] = useState<number | null>(null)
  const [npsReason, setNpsReason] = useState('')
  const [featureText, setFeatureText] = useState('')
  const [featureEmail, setFeatureEmail] = useState('')
  const [microSurvey, setMicroSurvey] = useState<(typeof MICRO_SURVEY_TRIGGERS)[string] | null>(null)
  const [microNote, setMicroNote] = useState('')
  const npsSubmitted = localStorage.getItem(NPS_STATE_KEY) === 'submitted'
  const npsDismissedRecently = daysSince(localStorage.getItem(NPS_DISMISSED_KEY)) < DISMISS_COOLDOWN_DAYS

  useEffect(() => {
    function onAnalyticsEvent(event: Event) {
      const detail = (event as CustomEvent<AnalyticsEventDetail>).detail
      if (!detail?.name) return

      if (MEANINGFUL_EVENTS.has(detail.name)) {
        const nextCount = readNumber(ACTIVITY_KEY) + 1
        localStorage.setItem(ACTIVITY_KEY, String(nextCount))
        setActivityCount(nextCount)

        if (!npsSubmitted && !npsDismissedRecently && nextCount >= ACTIVITY_THRESHOLD) {
          setNpsTrigger(detail.name)
          setMode((current) => current ?? 'nps')
        }
      }

      const survey = MICRO_SURVEY_TRIGGERS[detail.name]
      if (!survey || localStorage.getItem(`${MICRO_STATE_KEY}:${survey.id}`)) return
      setMicroSurvey(survey)
      setMicroNote('')
      setMode((current) => current ?? 'micro')
    }

    window.addEventListener('atlas:analytics-event', onAnalyticsEvent)
    return () => window.removeEventListener('atlas:analytics-event', onAnalyticsEvent)
  }, [npsDismissedRecently, npsSubmitted])

  const canSubmitFeature = featureText.trim().length >= 6
  const canSubmitNps = npsScore != null

  const panelTitle = useMemo(() => {
    if (mode === 'feature') return 'Request a feature'
    if (mode === 'micro') return microSurvey?.question ?? 'Quick check'
    return 'Quick score'
  }, [microSurvey?.question, mode])

  function closePanel() {
    if (mode === 'nps') {
      localStorage.setItem(NPS_DISMISSED_KEY, new Date().toISOString())
      trackEvent('NPS prompt dismissed', { activityCount })
    }
    if (mode === 'micro' && microSurvey) {
      localStorage.setItem(`${MICRO_STATE_KEY}:${microSurvey.id}`, 'dismissed')
      trackEvent('Micro survey dismissed', { surveyId: microSurvey.id })
    }
    setMode(null)
  }

  function submitNps() {
    if (!canSubmitNps) return
    localStorage.setItem(NPS_STATE_KEY, 'submitted')
    trackEvent('NPS survey submitted', {
      score: npsScore,
      reason: npsReason.trim() || undefined,
      trigger: npsTrigger,
      activityCount,
      source: 'feedback_dock',
    })
    setMode(null)
  }

  function submitMicro(answer: string) {
    if (!microSurvey) return
    localStorage.setItem(`${MICRO_STATE_KEY}:${microSurvey.id}`, 'submitted')
    trackEvent('Micro survey submitted', {
      surveyId: microSurvey.id,
      answer,
      note: microNote.trim() || undefined,
      source: 'feedback_dock',
    })
    setMode(null)
  }

  function submitFeature(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmitFeature) return
    const trimmedRequest = featureText.trim()
    const contactEmail = user?.email ?? (featureEmail.trim() || undefined)
    const personProperties = compactRecord({
      email: contactEmail,
      atlas_user_id: user?.id,
      entitled: user?.entitled,
      signedIn: Boolean(user),
    })
    trackEvent('Feature request submitted', {
      request: trimmedRequest,
      requestLength: trimmedRequest.length,
      email: contactEmail,
      signedIn: Boolean(user),
      userId: user?.id,
      source: 'feedback_dock',
      ...collectFeatureRequestContext(),
      ...(Object.keys(personProperties).length > 0 ? { $set: personProperties } : {}),
    })
    setFeatureText('')
    setFeatureEmail('')
    setMode(null)
  }

  return (
    <div className="feedback-dock" aria-live="polite">
      <button type="button" className="feedback-dock-trigger" onClick={() => setMode('feature')}>
        Request feature
      </button>

      {mode && (
        <div className="feedback-panel" role="dialog" aria-modal="false" aria-label={panelTitle}>
          <div className="feedback-panel-head">
            <strong>{panelTitle}</strong>
            <button type="button" onClick={closePanel} aria-label="Close feedback panel">
              ×
            </button>
          </div>

          {mode === 'nps' && (
            <div className="feedback-panel-body">
              <p>How likely are you to recommend Atlas to someone who watches the sky?</p>
              <div className="feedback-score-row">
                {Array.from({ length: 11 }, (_, score) => (
                  <button
                    type="button"
                    key={score}
                    className={npsScore === score ? 'is-selected' : ''}
                    onClick={() => setNpsScore(score)}
                  >
                    {score}
                  </button>
                ))}
              </div>
              <label className="feedback-field">
                <span>Reason</span>
                <textarea
                  value={npsReason}
                  onChange={(event) => setNpsReason(event.target.value)}
                  placeholder="Optional: what shaped that score?"
                  rows={3}
                />
              </label>
              <button type="button" className="feedback-submit" onClick={submitNps} disabled={!canSubmitNps}>
                Send
              </button>
            </div>
          )}

          {mode === 'micro' && microSurvey && (
            <div className="feedback-panel-body">
              <div className="feedback-option-row">
                {microSurvey.options.map((option) => (
                  <button type="button" key={option} onClick={() => submitMicro(option)}>
                    {option}
                  </button>
                ))}
              </div>
              <label className="feedback-field">
                <span>Note</span>
                <textarea
                  value={microNote}
                  onChange={(event) => setMicroNote(event.target.value)}
                  placeholder="Optional note"
                  rows={2}
                />
              </label>
            </div>
          )}

          {mode === 'feature' && (
            <form className="feedback-panel-body" onSubmit={submitFeature}>
              <label className="feedback-field">
                <span>Feature idea</span>
                <textarea
                  value={featureText}
                  onChange={(event) => setFeatureText(event.target.value)}
                  placeholder="What should Atlas add or improve?"
                  rows={4}
                  required
                />
              </label>
              {!user && (
                <label className="feedback-field">
                  <span>Email for follow-up</span>
                  <input
                    type="email"
                    value={featureEmail}
                    onChange={(event) => setFeatureEmail(event.target.value)}
                    placeholder="Email for follow-up (optional)"
                  />
                </label>
              )}
              <button type="submit" className="feedback-submit" disabled={!canSubmitFeature}>
                Send request
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

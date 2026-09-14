import { useEffect, useMemo, useState } from 'react'
import { getActiveSurveys, trackEvent } from '../lib/analytics'
import { useAuth } from '../lib/auth'

type FeedbackMode = 'nps' | 'micro' | 'feature' | 'postplan' | 'wtp' | null

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

// PostHog survey object IDs -- set once scripts/posthog-surveys-setup.mjs
// has created the matching survey in the dashboard. Undefined is fine:
// these only annotate capture() calls for PostHog's Surveys analytics tab,
// the local trigger/dedup logic below works identically either way.
const NPS_SURVEY_ID = import.meta.env.VITE_POSTHOG_NPS_SURVEY_ID as string | undefined
// ASV-26/ASV-27
const POSTPLAN_SURVEY_ID = import.meta.env.VITE_POSTHOG_POSTPLAN_SURVEY_ID as string | undefined
const WTP_SURVEY_ID = import.meta.env.VITE_POSTHOG_PAYWALL_WTP_SURVEY_ID as string | undefined
const POSTPLAN_STATE_KEY = 'atlas-feedback-postplan-state'
const WTP_STATE_KEY = 'atlas-feedback-wtp-state'

// Event names below must match src/lib/analytics.ts trackEvent() call sites
// exactly -- the ASV-2 frontend rebuild renamed several of these
// (e.g. "Generated first plan" -> "Tonight plan generation succeeded",
// "Logged observation attempt" -> "Logged observation") and this set had
// gone stale, silently undercounting activity and never reaching the NPS
// threshold in the rebuilt app.
const MEANINGFUL_EVENTS = new Set([
  'first_plan_target_tapped',
  'first_plan_equipment_selected',
  'Tonight plan generation succeeded',
  'Added get ready reminder',
  'Logged observation',
  'Sign up completed',
  'Paywall checkout clicked',
])

const MICRO_SURVEY_TRIGGERS: Record<string, { id: string; question: string; options: string[]; surveyId?: string }> = {
  'Submitted reminder feedback': {
    id: 'reminder_feedback_helpfulness',
    question: 'Was that reminder/check-in useful?',
    options: ['Yes', 'Somewhat', 'No'],
    surveyId: import.meta.env.VITE_POSTHOG_SURVEY_REMINDER_ID as string | undefined,
  },
  first_plan_target_tapped: {
    id: 'target_detail_clarity',
    question: 'Did this help you decide what to look for?',
    options: ['Yes', 'Not sure', 'No'],
    surveyId: import.meta.env.VITE_POSTHOG_SURVEY_TARGET_ID as string | undefined,
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
    '.mobile-profile-kicker, .dt-brand-subtitle, .settings-status, .paywall-copy strong',
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
  const [postPlanStopped, setPostPlanStopped] = useState('')
  const [postPlanMissing, setPostPlanMissing] = useState('')
  const [wtpAnswer, setWtpAnswer] = useState('')
  const [wtpBand, setWtpBand] = useState<string | null>(null)
  const npsSubmitted = localStorage.getItem(NPS_STATE_KEY) === 'submitted'
  const npsDismissedRecently = daysSince(localStorage.getItem(NPS_DISMISSED_KEY)) < DISMISS_COOLDOWN_DAYS
  // null = not checked yet. Only surveys with a PostHog survey ID wired up
  // (see NPS_SURVEY_ID / MICRO_SURVEY_TRIGGERS[*].surveyId) get gated on
  // this; until scripts/posthog-surveys-setup.mjs has been run, every
  // survey here is unconfigured and display falls back to the local
  // trigger/dedup logic exactly as before.
  const [activeSurveyIds, setActiveSurveyIds] = useState<Set<string> | null>(null)

  useEffect(() => {
    getActiveSurveys().then((surveys) => setActiveSurveyIds(new Set(surveys.map((s) => s.id))))
  }, [])

  useEffect(() => {
    function surveyIsActive(surveyId: string | undefined): boolean {
      if (!surveyId) return true
      if (activeSurveyIds === null) return true
      return activeSurveyIds.has(surveyId)
    }

    function onAnalyticsEvent(event: Event) {
      const detail = (event as CustomEvent<AnalyticsEventDetail>).detail
      if (!detail?.name) return

      if (MEANINGFUL_EVENTS.has(detail.name)) {
        const nextCount = readNumber(ACTIVITY_KEY) + 1
        localStorage.setItem(ACTIVITY_KEY, String(nextCount))
        setActivityCount(nextCount)

        if (!npsSubmitted && !npsDismissedRecently && nextCount >= ACTIVITY_THRESHOLD && surveyIsActive(NPS_SURVEY_ID)) {
          setNpsTrigger(detail.name)
          setMode((current) => {
            if (current == null && NPS_SURVEY_ID) trackEvent('survey shown', { $survey_id: NPS_SURVEY_ID })
            return current ?? 'nps'
          })
        }
      }

      const survey = MICRO_SURVEY_TRIGGERS[detail.name]
      if (survey && !localStorage.getItem(`${MICRO_STATE_KEY}:${survey.id}`) && surveyIsActive(survey.surveyId)) {
        setMicroSurvey(survey)
        setMicroNote('')
        setMode((current) => {
          if (current == null && survey.surveyId) trackEvent('survey shown', { $survey_id: survey.surveyId })
          return current ?? 'micro'
        })
      }

      // ASV-26: once per user, right after the value moment (Tonight plan
      // generated) while the friction or gap that got them there is fresh.
      if (
        detail.name === 'Tonight plan generation succeeded' &&
        !localStorage.getItem(POSTPLAN_STATE_KEY) &&
        surveyIsActive(POSTPLAN_SURVEY_ID)
      ) {
        setMode((current) => {
          if (current == null && POSTPLAN_SURVEY_ID) trackEvent('survey shown', { $survey_id: POSTPLAN_SURVEY_ID })
          return current ?? 'postplan'
        })
      }

      // ASV-27: once per user, the first time they actually reach a
      // paywall (not on every checkout click) -- pairs with the
      // "Paywall checkout clicked" feature breakdown as the
      // stated-preference half of the WTP question.
      if (detail.name === 'Paywall viewed' && !localStorage.getItem(WTP_STATE_KEY) && surveyIsActive(WTP_SURVEY_ID)) {
        setMode((current) => {
          if (current == null && WTP_SURVEY_ID) trackEvent('survey shown', { $survey_id: WTP_SURVEY_ID })
          return current ?? 'wtp'
        })
      }
    }

    window.addEventListener('atlas:analytics-event', onAnalyticsEvent)
    return () => window.removeEventListener('atlas:analytics-event', onAnalyticsEvent)
  }, [npsDismissedRecently, npsSubmitted, activeSurveyIds])

  useEffect(() => {
    function openFeatureRequest() {
      setMode('feature')
    }
    window.addEventListener('atlas:open-feature-request', openFeatureRequest)
    return () => window.removeEventListener('atlas:open-feature-request', openFeatureRequest)
  }, [])

  const canSubmitFeature = featureText.trim().length >= 6
  const canSubmitNps = npsScore != null
  const canSubmitWtp = wtpBand != null

  const panelTitle = useMemo(() => {
    if (mode === 'feature') return 'Request a feature'
    if (mode === 'micro') return microSurvey?.question ?? 'Quick check'
    if (mode === 'postplan') return 'Quick question about tonight'
    if (mode === 'wtp') return 'What would make Sky Pass worth it?'
    return 'Quick score'
  }, [microSurvey?.question, mode])

  function closePanel() {
    if (mode === 'nps') {
      localStorage.setItem(NPS_DISMISSED_KEY, new Date().toISOString())
      if (NPS_SURVEY_ID) {
        trackEvent('survey dismissed', { $survey_id: NPS_SURVEY_ID, activityCount })
      } else {
        trackEvent('NPS prompt dismissed', { activityCount })
      }
    }
    if (mode === 'micro' && microSurvey) {
      localStorage.setItem(`${MICRO_STATE_KEY}:${microSurvey.id}`, 'dismissed')
      if (microSurvey.surveyId) {
        trackEvent('survey dismissed', { $survey_id: microSurvey.surveyId, surveyKey: microSurvey.id })
      } else {
        trackEvent('Micro survey dismissed', { surveyId: microSurvey.id })
      }
    }
    if (mode === 'postplan') {
      localStorage.setItem(POSTPLAN_STATE_KEY, 'dismissed')
      trackEvent('survey dismissed', POSTPLAN_SURVEY_ID ? { $survey_id: POSTPLAN_SURVEY_ID } : { surveyKey: 'postplan' })
    }
    if (mode === 'wtp') {
      localStorage.setItem(WTP_STATE_KEY, 'dismissed')
      trackEvent('survey dismissed', WTP_SURVEY_ID ? { $survey_id: WTP_SURVEY_ID } : { surveyKey: 'paywall_wtp' })
    }
    setMode(null)
  }

  function submitPostPlan() {
    localStorage.setItem(POSTPLAN_STATE_KEY, 'submitted')
    trackEvent('survey sent', {
      ...(POSTPLAN_SURVEY_ID ? { $survey_id: POSTPLAN_SURVEY_ID } : { surveyKey: 'postplan' }),
      almostStopped: postPlanStopped.trim() || undefined,
      missingForTomorrow: postPlanMissing.trim() || undefined,
      source: 'feedback_dock',
    })
    setMode(null)
  }

  function submitWtp() {
    if (!canSubmitWtp) return
    localStorage.setItem(WTP_STATE_KEY, 'submitted')
    trackEvent('survey sent', {
      ...(WTP_SURVEY_ID ? { $survey_id: WTP_SURVEY_ID } : { surveyKey: 'paywall_wtp' }),
      whatWouldMakeItWorthPaying: wtpAnswer.trim() || undefined,
      wtpBand,
      source: 'feedback_dock',
    })
    setMode(null)
  }

  function submitNps() {
    if (!canSubmitNps) return
    localStorage.setItem(NPS_STATE_KEY, 'submitted')
    if (NPS_SURVEY_ID) {
      trackEvent('survey sent', {
        $survey_id: NPS_SURVEY_ID,
        $survey_response: npsScore,
        reason: npsReason.trim() || undefined,
        trigger: npsTrigger,
        activityCount,
        source: 'feedback_dock',
      })
    } else {
      trackEvent('NPS survey submitted', {
        score: npsScore,
        reason: npsReason.trim() || undefined,
        trigger: npsTrigger,
        activityCount,
        source: 'feedback_dock',
      })
    }
    setMode(null)
  }

  function submitMicro(answer: string) {
    if (!microSurvey) return
    localStorage.setItem(`${MICRO_STATE_KEY}:${microSurvey.id}`, 'submitted')
    if (microSurvey.surveyId) {
      trackEvent('survey sent', {
        $survey_id: microSurvey.surveyId,
        $survey_response: answer,
        surveyKey: microSurvey.id,
        note: microNote.trim() || undefined,
        source: 'feedback_dock',
      })
    } else {
      trackEvent('Micro survey submitted', {
        surveyId: microSurvey.id,
        answer,
        note: microNote.trim() || undefined,
        source: 'feedback_dock',
      })
    }
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
    <div className={`feedback-dock${mode ? ' feedback-dock--open' : ''}`} aria-live="polite">
      <button type="button" className="feedback-dock-trigger" onClick={() => setMode('feature')} aria-label="Request feature">
        <span className="feedback-dock-trigger-icon" aria-hidden="true">
          +
        </span>
        <span className="feedback-dock-trigger-label">Request feature</span>
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

          {mode === 'postplan' && (
            <div className="feedback-panel-body">
              <label className="feedback-field">
                <span>What almost stopped you?</span>
                <textarea
                  value={postPlanStopped}
                  onChange={(event) => setPostPlanStopped(event.target.value)}
                  placeholder="Optional"
                  rows={2}
                />
              </label>
              <label className="feedback-field">
                <span>What's missing for tomorrow night?</span>
                <textarea
                  value={postPlanMissing}
                  onChange={(event) => setPostPlanMissing(event.target.value)}
                  placeholder="Optional"
                  rows={2}
                />
              </label>
              <button type="button" className="feedback-submit" onClick={submitPostPlan}>
                Send
              </button>
            </div>
          )}

          {mode === 'wtp' && (
            <div className="feedback-panel-body">
              <label className="feedback-field">
                <span>What would make this worth paying for?</span>
                <textarea
                  value={wtpAnswer}
                  onChange={(event) => setWtpAnswer(event.target.value)}
                  placeholder="Optional"
                  rows={2}
                />
              </label>
              <div className="feedback-option-row">
                {['Free only', '$3-5', '$6-10', 'Tours only'].map((band) => (
                  <button
                    type="button"
                    key={band}
                    className={wtpBand === band ? 'is-selected' : ''}
                    onClick={() => setWtpBand(band)}
                  >
                    {band}
                  </button>
                ))}
              </div>
              <button type="button" className="feedback-submit" onClick={submitWtp} disabled={!canSubmitWtp}>
                Send
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

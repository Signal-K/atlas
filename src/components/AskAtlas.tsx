import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { askAtlas, GuestAskBurstError, GuestAskLimitError } from '../lib/ai'
import { trackEvent } from '../lib/analytics'
import {
  GUEST_ASK_LIMIT,
  GUEST_ASK_STORAGE_KEY,
  guestAskDecision,
  readGuestAskUsed,
  writeGuestAskUsed,
} from '../lib/guestAskLimit.mjs'

export interface AskAtlasProps {
  entitled: boolean
  // Logged-out visitors get a short allowance, then a sign-up prompt.
  // Signed-in accounts without Sky Pass keep the upsell.
  guest?: boolean
  context?: string
}

function storedGuestAsks(): number {
  try {
    return readGuestAskUsed(window.localStorage.getItem(GUEST_ASK_STORAGE_KEY))
  } catch {
    return 0
  }
}

function rememberGuestAsks(used: number) {
  try {
    window.localStorage.setItem(GUEST_ASK_STORAGE_KEY, writeGuestAskUsed(used))
  } catch {
    // The server counter still applies if this device cannot store the hint.
  }
}

export function AskAtlas({ entitled, guest = false, context }: AskAtlasProps) {
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [guestUsed, setGuestUsed] = useState(() => (guest && !entitled ? storedGuestAsks() : 0))
  const [needsAccount, setNeedsAccount] = useState(() => guest && !entitled && !guestAskDecision(storedGuestAsks()).allowed)

  if (!entitled && !guest) {
    return (
      <section className="az-card" style={{ marginTop: '1.125rem' }}>
        <div className="az-card-body">
          <span className="az-kicker">Sky Pass</span>
          <h2 style={{ margin: '0.3125rem 0 0', fontFamily: 'var(--az-font-display)', fontSize: '1.25rem' }}>Questions are ready when you are.</h2>
          <p className="az-muted" style={{ margin: '0.5rem 0 0', fontSize: '0.84375rem' }}>
            Sky Pass unlocks concise advice for tonight&rsquo;s sky, a specific event, or your camera setup.
          </p>
        </div>
      </section>
    )
  }

  if (needsAccount) {
    return (
      <section className="az-card" style={{ marginTop: '1.125rem' }}>
        <div className="az-card-body">
          {answer && (
            <div className="az-row-group" style={{ marginBottom: '1rem' }}>
              <div className="az-row" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                <span className="az-row-main">
                  <span className="az-row-kind">ATLAS SAYS</span>
                  <span style={{ display: 'block', marginTop: '0.375rem', fontSize: '0.875rem', lineHeight: 1.55 }}>{answer}</span>
                </span>
              </div>
            </div>
          )}
          <span className="az-kicker">Free questions used</span>
          <h2 style={{ margin: '0.3125rem 0 0', fontFamily: 'var(--az-font-display)', fontSize: '1.25rem' }}>Create a free account to keep asking.</h2>
          <p className="az-muted" style={{ margin: '0.5rem 0 0', fontSize: '0.84375rem' }}>
            Guests can ask {GUEST_ASK_LIMIT} questions a day. An account keeps your journal, and Sky Pass removes the limit.
          </p>
          <button type="button" className="az-btn az-btn-primary az-btn-block" style={{ marginTop: '0.75rem' }} onClick={() => navigate('/app/profile')}>
            Create a free account
          </button>
        </div>
      </section>
    )
  }

  const suggestions = ['What is easiest to see tonight?', 'When should I go outside?', 'How should I use my phone camera?']
  const guestDecision = guest && !entitled ? guestAskDecision(guestUsed) : null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = question.trim()
    if (!trimmed || busy) return
    if (guestDecision && !guestDecision.allowed) {
      setNeedsAccount(true)
      return
    }
    setBusy(true)
    setError('')
    setAnswer('')
    try {
      const result = await askAtlas(trimmed, context)
      setAnswer(result)
      if (guest && !entitled) {
        const next = guestUsed + 1
        setGuestUsed(next)
        rememberGuestAsks(next)
        if (!guestAskDecision(next).allowed) setNeedsAccount(true)
      }
    } catch (err) {
      if (err instanceof GuestAskLimitError) {
        setGuestUsed(GUEST_ASK_LIMIT)
        rememberGuestAsks(GUEST_ASK_LIMIT)
        setNeedsAccount(true)
        return
      }
      if (err instanceof GuestAskBurstError) {
        setError('Wait a moment, then ask again.')
        return
      }
      setError(err instanceof Error && err.message ? err.message : 'Could not reach Atlas right now. Try again shortly.')
      trackEvent('ask_atlas_failed', { error: String(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="az-card" style={{ marginTop: '1.125rem' }} aria-labelledby="ask-atlas-prompt-title">
      <div className="az-card-body">
        <h2 id="ask-atlas-prompt-title" style={{ margin: 0, fontFamily: 'var(--az-font-display)', fontSize: '1.25rem' }}>What do you want to know?</h2>
        <p className="az-muted" style={{ margin: '0.3125rem 0 0.75rem', fontSize: '0.84375rem' }}>
          {guestDecision
            ? `${guestDecision.remaining} free ${guestDecision.remaining === 1 ? 'question' : 'questions'} left today.`
            : 'Ask one practical question. Atlas will keep the answer focused.'}
        </p>
        <div className="az-chip-row" style={{ flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          {suggestions.map((suggestion) => (
            <button key={suggestion} type="button" className="az-chip" onClick={() => setQuestion(suggestion)}>{suggestion}</button>
          ))}
        </div>
        <form onSubmit={handleSubmit}>
          <label className="az-kicker" htmlFor="ask-atlas-question" style={{ display: 'block', marginBottom: '0.375rem' }}>Your question</label>
          <textarea
            id="ask-atlas-question"
            rows={3}
            placeholder="For example: What can I see after dark?"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
          <button type="submit" className="az-btn az-btn-primary az-btn-block" style={{ marginTop: '0.75rem' }} disabled={busy || !question.trim()}>
            {busy ? 'Asking Atlas…' : 'Ask Atlas'}
          </button>
        </form>
        {error && <p role="alert" style={{ color: 'var(--az-flagship)', fontSize: '0.8125rem', margin: '0.75rem 0 0' }}>{error}</p>}
        {answer && (
          <div className="az-row-group" style={{ marginTop: '1rem' }}>
            <div className="az-row" style={{ cursor: 'default', alignItems: 'flex-start' }}>
              <span className="az-row-main">
                <span className="az-row-kind">ATLAS SAYS</span>
                <span style={{ display: 'block', marginTop: '0.375rem', fontSize: '0.875rem', lineHeight: 1.55 }}>{answer}</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

import { useState } from 'react'
import { askAtlas } from '../lib/ai'
import { trackEvent } from '../lib/analytics'

export interface AskAtlasProps {
  entitled: boolean
  context?: string
}

// A Sky Pass-only Q&A box (pocketbase/pb_hooks/ask-atlas.pb.js's POST
// /atlas/ask), for questions specific to the page it's mounted on. Free
// accounts see an upsell instead of the input, since each answer costs a
// metered Claude API call.
export function AskAtlas({ entitled, context }: AskAtlasProps) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!entitled) {
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

  const suggestions = ['What is easiest to see tonight?', 'When should I go outside?', 'How should I use my phone camera?']

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = question.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError('')
    setAnswer('')
    try {
      const result = await askAtlas(trimmed, context)
      setAnswer(result)
    } catch (err) {
      setError('Could not reach Atlas right now. Try again shortly.')
      trackEvent('ask_atlas_failed', { error: String(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="az-card" style={{ marginTop: '1.125rem' }} aria-labelledby="ask-atlas-prompt-title">
      <div className="az-card-body">
        <h2 id="ask-atlas-prompt-title" style={{ margin: 0, fontFamily: 'var(--az-font-display)', fontSize: '1.25rem' }}>What do you want to know?</h2>
        <p className="az-muted" style={{ margin: '0.3125rem 0 0.75rem', fontSize: '0.84375rem' }}>Ask one practical question. Atlas will keep the answer focused.</p>
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

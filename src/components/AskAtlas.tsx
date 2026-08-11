import { useState } from 'react'
import { Link } from 'react-router-dom'
import { askAtlas } from '../lib/ai'

export interface AskAtlasProps {
  entitled: boolean
  context?: string
}

// A Sky Pass-only Q&A box (backend/main.go's POST /ai/ask), for questions
// specific to the page it's mounted on -- e.g. "is my Nothing Phone (2) good
// enough for this?" on an event page. Free accounts see an upsell instead of
// the input, since each answer costs a metered Claude API call.
export function AskAtlas({ entitled, context }: AskAtlasProps) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!entitled) {
    return (
      <section className="ui-section ui-ask-atlas">
        <h2 className="ui-section-title">Ask Atlas</h2>
        <p className="ui-calendar-substat">
          <Link to="/app/account">Get the Sky Pass</Link> to ask Atlas questions about tonight's sky, this event, or your camera setup.
        </p>
      </section>
    )
  }

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
    } catch {
      setError('Could not reach Atlas right now. Try again shortly.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="ui-section ui-ask-atlas">
      <h2 className="ui-section-title">Ask Atlas</h2>
      <form onSubmit={handleSubmit} className="ui-ask-atlas-form">
        <input
          className="ui-input"
          type="text"
          placeholder="Ask a question about tonight's sky, this event, or your camera setup…"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <button type="submit" className="ui-button ui-button-primary" disabled={busy || !question.trim()}>
          {busy ? 'Asking…' : 'Ask'}
        </button>
      </form>
      {error && <p className="account-form-error">{error}</p>}
      {answer && <p className="ui-ask-atlas-answer">{answer}</p>}
    </section>
  )
}

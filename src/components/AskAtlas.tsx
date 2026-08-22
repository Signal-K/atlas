import { useState } from 'react'
import { askAtlas } from '../lib/ai'
import { Card } from '../ui/Card'

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
      <Card className="settings-section">
        <p className="settings-help">Get the Sky Pass to ask Atlas questions about tonight's sky, an event, or your camera setup.</p>
      </Card>
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
    <Card className="settings-section">
      <form onSubmit={handleSubmit} className="ask-atlas-form">
        <input
          type="text"
          placeholder="Ask a question about tonight's sky, this event, or your camera setup…"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <button type="submit" className="paywall-card-cta" disabled={busy || !question.trim()}>
          {busy ? 'Asking…' : 'Ask'}
        </button>
      </form>
      {error && <p className="account-form-error">{error}</p>}
      {answer && <p className="ask-atlas-answer">{answer}</p>}
    </Card>
  )
}

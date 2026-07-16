import { useState } from 'react'
import { subscribeForUpdates, trackEvent } from '../lib/analytics'

const SUBSCRIBED_KEY = 'atlas-subscribed-updates'

export function UpdatesSignupForm({ source }: { source: string }) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(() => localStorage.getItem(SUBSCRIBED_KEY) === '1')
  const [started, setStarted] = useState(false)

  function trackStarted() {
    if (started) return
    setStarted(true)
    trackEvent('Updates form started', { source })
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    subscribeForUpdates(trimmed, { source })
    localStorage.setItem(SUBSCRIBED_KEY, '1')
    setSubmitted(true)
  }

  if (submitted) {
    return <p className="updates-form-success">You&apos;re on the list — we&apos;ll email you about new features.</p>
  }

  return (
    <form className="updates-form" onSubmit={handleSubmit} onFocus={trackStarted}>
      <input
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <button type="submit">Get updates</button>
    </form>
  )
}

import { useEffect, useState } from 'react'
import { EVENT_CATEGORIES } from '../../lib/eventCategories'
import { getPreferredEventTypes, hasCompletedEventPreferences, savePreferredEventTypes } from '../../lib/eventPreferences'
import { trackEvent } from '../../lib/analytics'

const OPTIONS = EVENT_CATEGORIES.filter((category) => category.id !== 'sky-guides')

export function EventPreferencePrompt({ onSaved }: { onSaved: (kinds: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getPreferredEventTypes().then((kinds) => setSelected(kinds))
  }, [])

  function toggle(categoryKinds: string[]) {
    setSelected((current) => {
      const active = categoryKinds.every((kind) => current.includes(kind))
      return active ? current.filter((kind) => !categoryKinds.includes(kind)) : [...new Set([...current, ...categoryKinds])]
    })
  }

  async function save() {
    if (selected.length === 0) return
    setBusy(true)
    await savePreferredEventTypes(selected)
    trackEvent('Set event preferences', { kinds: selected })
    onSaved(selected)
    setBusy(false)
  }

  if (hasCompletedEventPreferences()) return null

  return (
    <section className="dt-preference-prompt" aria-labelledby="event-preferences-title">
      <span className="dt-section-eyebrow">Make Today yours</span>
      <h2 id="event-preferences-title">What do you want to see?</h2>
      <p>Pick a few event types and Atlas will put them first in your home feed.</p>
      <div className="dt-preference-grid">
        {OPTIONS.map((category) => {
          const active = category.kinds.every((kind) => selected.includes(kind))
          return (
            <button
              type="button"
              key={category.id}
              className={`dt-preference-option${active ? ' is-active' : ''}`}
              onClick={() => toggle(category.kinds)}
              aria-pressed={active}
            >
              <span>{category.label}</span>
              <small>{active ? 'Prioritised' : 'Add to feed'}</small>
            </button>
          )
        })}
      </div>
      <button type="button" className="dt-primary-btn" onClick={save} disabled={busy || selected.length === 0}>
        {busy ? 'Saving…' : 'Show my feed'}
      </button>
    </section>
  )
}

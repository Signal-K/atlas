import { useEffect, useState } from 'react'
import { db, type ObservationLogEntry } from '../lib/db'
import { pushObservation } from '../lib/sync'
import { useAuth } from '../lib/auth'

// Entries made while signed out are scoped to this fixed local id so the
// Scrapbook still works fully offline-first with no account. Once signed
// in, new entries are scoped to the real user id (and also pushed to
// PocketBase) — entries logged before signing in stay under 'local' and
// won't reappear once signed in; that's an acceptable gap for now.
const LOCAL_USER_ID = 'local'

export function ScrapbookView() {
  const { user } = useAuth()
  const scopeId = user?.id ?? LOCAL_USER_ID
  const [entries, setEntries] = useState<ObservationLogEntry[]>([])
  const [note, setNote] = useState('')

  async function refresh() {
    const all = await db.observations.where('userId').equals(scopeId).reverse().sortBy('observedAt')
    setEntries(all)
  }

  useEffect(() => {
    refresh()
  }, [scopeId])

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = note.trim()
    if (!trimmed) return

    const entry: ObservationLogEntry = {
      id: crypto.randomUUID(),
      userId: scopeId,
      observedAt: new Date().toISOString(),
      note: trimmed,
    }
    await db.observations.add(entry)
    setNote('')
    await refresh()
    await pushObservation(entry)
  }

  return (
    <section className="widget-section">
      <h2>Scrapbook</h2>
      {!user && <p className="scrapbook-hint">Sign in (Settings) to sync your notes to your account.</p>}
      <form className="scrapbook-form" onSubmit={handleSave}>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What did you see tonight?"
          rows={3}
        />
        <button type="submit" className="scrapbook-submit">
          Save observation
        </button>
      </form>
      {entries.length === 0 ? (
        <p>Nothing logged yet — your sky-watching notes will show up here.</p>
      ) : (
        <ul className="row-list">
          {entries.map((entry) => (
            <li key={entry.id} className="scrapbook-entry">
              <p className="row-text">{entry.note}</p>
              <span className="row-meta">
                {new Date(entry.observedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

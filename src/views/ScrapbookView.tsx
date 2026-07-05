import { useEffect, useState } from 'react'
import { db, type ObservationLogEntry } from '../lib/db'

// No auth/login flow exists yet, so entries are scoped to a fixed local
// user until PocketBase auth lands — they still work fully offline-first.
const LOCAL_USER_ID = 'local'

export function ScrapbookView() {
  const [entries, setEntries] = useState<ObservationLogEntry[]>([])
  const [note, setNote] = useState('')

  async function refresh() {
    const all = await db.observations.where('userId').equals(LOCAL_USER_ID).reverse().sortBy('observedAt')
    setEntries(all)
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = note.trim()
    if (!trimmed) return

    await db.observations.add({
      id: crypto.randomUUID(),
      userId: LOCAL_USER_ID,
      observedAt: new Date().toISOString(),
      note: trimmed,
    })
    setNote('')
    await refresh()
  }

  return (
    <section className="widget-section">
      <h2>Scrapbook</h2>
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

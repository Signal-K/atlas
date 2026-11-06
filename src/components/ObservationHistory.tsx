import type { ObservationLogEntry } from '../lib/db'

export function ObservationHistory({ entries, query }: { entries: ObservationLogEntry[]; query: string }) {
  const visible = entries.filter(entry => `${entry.targetName ?? ''} ${entry.note ?? ''} ${entry.locationLabel ?? ''}`.toLowerCase().includes(query.toLowerCase()))
  const groups = new Map<string, ObservationLogEntry[]>()
  for (const entry of visible) {
    const month = new Date(entry.observedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    groups.set(month, [...(groups.get(month) ?? []), entry])
  }
  return <section className="observation-history"><p className="document-intro">Your observing nights, in order.</p>{visible.length === 0 && <p className="empty-state">{query ? 'No observations match your search.' : 'Your history will grow as you add observations to your journal.'}</p>}{[...groups].map(([month, observations]) => <section className="history-month" key={month}><h2>{month}</h2>{observations.map(entry => <article className="history-entry" key={entry.id}><time dateTime={entry.observedAt}>{new Date(entry.observedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</time><div><h3>{entry.targetName || 'An observing night'}</h3>{entry.locationLabel && <p>{entry.locationLabel}</p>}{entry.note && <p>{entry.note}</p>}</div></article>)}</section>)}</section>
}

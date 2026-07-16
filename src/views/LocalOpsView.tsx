import { useEffect, useState } from 'react'
import { getLocalOpsSnapshot, type LocalOpsSnapshot } from '../lib/localOps'
import { isDemoMode, isDemoModeForcedByEnv, setDemoMode } from '../lib/demoMode'

function statusLabel(status: string): string {
  if (status === 'online') return 'Online'
  if (status === 'offline') return 'Offline'
  if (status === 'local-only') return 'Local'
  return 'Checking'
}

export function LocalOpsView() {
  const [snapshot, setSnapshot] = useState<LocalOpsSnapshot | null>(null)

  async function refresh() {
    setSnapshot(await getLocalOpsSnapshot())
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <section className="widget-section">
      <div className="ops-header">
        <div>
          <h2>Local ops</h2>
          <p className="scrapbook-hint">Local-only diagnostics for PocketBase links, service reachability, and recent Atlas writes.</p>
        </div>
        <button type="button" className="scrapbook-submit" onClick={refresh}>
          Refresh
        </button>
      </div>

      {import.meta.env.DEV && (
        <div className="ops-demo-mode">
          <label>
            <input
              type="checkbox"
              checked={isDemoMode()}
              disabled={isDemoModeForcedByEnv()}
              onChange={(event) => {
                setDemoMode(event.target.checked)
                window.location.reload()
              }}
            />
            Demo mode — skip PocketBase, use cached/fixture data only (no Docker needed)
          </label>
          <p className="scrapbook-hint">
            {isDemoModeForcedByEnv()
              ? 'Forced on via VITE_DEMO_MODE (make demo) — restart the dev server without it to turn off.'
              : 'Local dev only. Reloads the page when toggled.'}
          </p>
        </div>
      )}

      {snapshot === null ? (
        <p>Loading&hellip;</p>
      ) : (
        <>
          <h3 className="calendar-selected-heading">PocketBase links</h3>
          <ul className="ops-link-list">
            {snapshot.links.map((link) => (
              <li key={link.href} className="ops-link-row">
                <a href={link.href} target="_blank" rel="noreferrer">
                  {link.label}
                </a>
                <span>{link.href}</span>
                <p>{link.description}</p>
              </li>
            ))}
          </ul>

          <h3 className="calendar-selected-heading">Local containers</h3>
          <ul className="ops-container-list">
            {snapshot.containers.map((container) => (
              <li key={container.name} className="ops-container-row">
                <div>
                  <strong>{container.name}</strong>
                  <span>{container.kind}</span>
                  {container.url && <a href={container.url}>{container.url}</a>}
                </div>
                <span className={`ops-status ops-status--${container.status}`}>{statusLabel(container.status)}</span>
                <p>{container.detail}</p>
              </li>
            ))}
          </ul>

          <h3 className="calendar-selected-heading">Latest transactions</h3>
          {snapshot.transactions.length === 0 ? (
            <p className="scrapbook-hint">No local write activity recorded yet.</p>
          ) : (
            <ul className="ops-transaction-list">
              {snapshot.transactions.map((transaction) => (
                <li key={transaction.id} className="ops-transaction-row">
                  <span className="ops-transaction-source">{transaction.source}</span>
                  <span className="ops-transaction-action">{transaction.action}</span>
                  <span className="ops-transaction-detail">{transaction.detail}</span>
                  <span className="ops-transaction-time">
                    {new Date(transaction.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

import { getOnboardingAnswers } from '../lib/onboarding'
import { visibleSaturnTasks } from '../lib/telescopeSaturnTasks.mjs'

// ASV-128. Telescope Saturn/Jupiter science tasks. Atlas hosts no data: each
// task links out to the archive it belongs in.
export function TelescopeSaturnTasksCard() {
  const hasTelescope = getOnboardingAnswers().viewingInstruments.includes('telescope')
  const { tasks, fallback } = visibleSaturnTasks({ hasTelescope, now: new Date() })
  if (!fallback && tasks.length === 0) return null

  return (
    <section className="az-card" style={{ marginTop: '0.75rem' }} aria-label="Saturn science tasks">
      <div className="az-card-body">
        <span className="az-kicker">{fallback ? fallback.title : 'Saturn science tasks'}</span>
        {fallback && (
          <p className="az-muted" style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem' }}>
            {fallback.detail}
          </p>
        )}
        <ul style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0, display: 'grid', gap: '0.75rem' }}>
          {tasks.map((task) => (
            <li key={task.id} data-saturn-task={task.id} data-badge={task.badge}>
              <p style={{ margin: 0 }}>
                <strong>{task.title}</strong> <span className="az-muted">({task.badge} badge)</span>
              </p>
              <p className="az-muted" style={{ margin: '0.125rem 0', fontSize: '0.8125rem' }}>{task.detail}</p>
              <p style={{ margin: 0, fontSize: '0.8125rem' }}>
                Send to:{' '}
                {task.links.map((link, index) => (
                  <span key={link.url}>
                    {index > 0 && ', '}
                    <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

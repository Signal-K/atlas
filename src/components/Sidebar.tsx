import { Fragment, type ReactElement } from 'react'

// Reduced from 11 flat slots to 6: related views now share a single slot
// and are switched between via an in-page TabbedSection instead of each
// getting its own sidebar entry (see App.tsx) --
//   Explore   = Dashboard + Calendar
//   Community = Feed + Photo Challenges
//   History   = Archive + Scrapbook
//   Plan      = Dark-sky trips + Deep-sky planner
//   Settings  = Settings + Local ops (diagnostics)
export type View = 'tonight' | 'explore' | 'community' | 'history' | 'plan' | 'settings'

const ITEMS: Array<{ id: View; label: string; icon: ReactElement }> = [
  {
    id: 'tonight',
    label: 'Tonight',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14.5 11.2A5.5 5.5 0 0 1 8.8 5.5c0-.7.1-1.4.4-2A6.5 6.5 0 1 0 16.5 10.8c-.7.3-1.4.4-2 .4Z" />
      </svg>
    ),
  },
  {
    id: 'explore',
    label: 'Explore',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="6" height="6" rx="1" />
        <rect x="11" y="3" width="6" height="6" rx="1" />
        <rect x="3" y="11" width="6" height="6" rx="1" />
        <rect x="11" y="11" width="6" height="6" rx="1" />
      </svg>
    ),
  },
  {
    id: 'plan',
    label: 'Plan a trip',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 15c3-6 5-9 7-9s4 3 7 9" />
        <circle cx="10" cy="4.5" r="1.5" fill="currentColor" stroke="none" />
        <path d="M2 15h16" />
      </svg>
    ),
  },
  {
    id: 'community',
    label: 'Community',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 4h9l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
        <path d="M7 9h6M7 12h6M7 6h3" />
      </svg>
    ),
  },
  {
    id: 'history',
    label: 'History',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="4" width="14" height="4" rx="1" />
        <path d="M4 8v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8" />
        <path d="M8 11h4" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="10" cy="10" r="3" />
        <path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.36 4.64l-1.41 1.41M6.05 13.95l-1.41 1.41M15.36 15.36l-1.41-1.41M6.05 6.05 4.64 4.64" />
      </svg>
    ),
  },
]

export function Sidebar({ active, onSelect }: { active: View; onSelect: (view: View) => void }) {
  return (
    <nav className="sidebar" aria-label="Primary">
      {ITEMS.map((item, index) => (
        <Fragment key={item.id}>
          {index === 1 && <hr className="sidebar-divider" />}
          <button
            type="button"
            className={`sidebar-item${active === item.id ? ' is-active' : ''}`}
            onClick={() => onSelect(item.id)}
            aria-current={active === item.id}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        </Fragment>
      ))}
    </nav>
  )
}

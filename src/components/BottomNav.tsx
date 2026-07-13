import { Fragment, type ReactElement } from 'react'

export type MobileTab = 'hub' | 'events' | 'calendar' | 'watch' | 'journal'

const ITEMS: Array<{ id: MobileTab; label: string; icon: ReactElement }> = [
  {
    id: 'hub',
    label: 'Hub',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="10" cy="10" r="7" />
        <path d="M10 3v3M10 14v3M3 10h3M14 10h3" />
      </svg>
    ),
  },
  {
    id: 'events',
    label: 'Events',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="10" cy="10" r="2.2" />
        <path d="M10 2v3M10 15v3M2 10h3M15 10h3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="4" width="14" height="13" rx="1.5" />
        <path d="M3 8h14M7 2v4M13 2v4" />
      </svg>
    ),
  },
  {
    id: 'watch',
    label: 'Watch',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" stroke="none">
        <path d="M10 2.5l2.3 4.9 5.3.7-3.9 3.7 1 5.3L10 14.6l-4.7 2.5 1-5.3-3.9-3.7 5.3-.7L10 2.5Z" />
      </svg>
    ),
  },
  {
    id: 'journal',
    label: 'Journal',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 3.5h9l3 3v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
        <path d="M7 8.5h6M7 11.5h6M7 5.5h3" />
      </svg>
    ),
  },
]

export function BottomNav({ active, onSelect }: { active: MobileTab; onSelect: (tab: MobileTab) => void }) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {ITEMS.map((item) => (
        <Fragment key={item.id}>
          <button
            type="button"
            className={`bottom-nav-item${active === item.id ? ' is-active' : ''}`}
            onClick={() => onSelect(item.id)}
            aria-current={active === item.id}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </button>
        </Fragment>
      ))}
    </nav>
  )
}

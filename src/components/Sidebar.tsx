import type { ReactElement } from 'react'

export type View = 'dashboard' | 'archive' | 'scrapbook' | 'settings'

const ITEMS: Array<{ id: View; label: string; icon: ReactElement }> = [
  {
    id: 'dashboard',
    label: 'Dashboard',
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
    id: 'archive',
    label: 'Archive',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="4" width="14" height="4" rx="1" />
        <path d="M4 8v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8" />
        <path d="M8 11h4" />
      </svg>
    ),
  },
  {
    id: 'scrapbook',
    label: 'Scrapbook',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M5 3h10a1 1 0 0 1 1 1v13l-6-3-6 3V4a1 1 0 0 1 1-1Z" />
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
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`sidebar-item${active === item.id ? ' is-active' : ''}`}
          onClick={() => onSelect(item.id)}
          aria-label={item.label}
          aria-current={active === item.id}
          title={item.label}
        >
          {item.icon}
        </button>
      ))}
    </nav>
  )
}

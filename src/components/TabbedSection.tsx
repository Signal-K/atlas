import { useState, type ReactNode } from 'react'

export interface Tab {
  id: string
  label: string
  content: ReactNode
}

// Lets several distinct views share one sidebar slot (e.g. Today + Events +
// Plan under "Explore") via an in-page segmented control, rather than
// each getting its own top-level sidebar entry. `defaultActiveId` plus a
// `key` on this component (set by the caller) is how a parent can force a
// specific tab open when navigating in from elsewhere -- see App.tsx's
// `logAttempt`, which needs "History" to open on the Scrapbook tab rather
// than whichever tab was last active.
export function TabbedSection({ tabs, defaultActiveId }: { tabs: Tab[]; defaultActiveId?: string }) {
  const [activeId, setActiveId] = useState(defaultActiveId ?? tabs[0].id)
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0]

  return (
    <div className="tabbed-section">
      <div className="tabbed-section-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === active.id}
            className={`tabbed-section-tab${tab.id === active.id ? ' is-active' : ''}`}
            onClick={() => setActiveId(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {active.content}
    </div>
  )
}

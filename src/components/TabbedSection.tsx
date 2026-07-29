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
  const initialId = defaultActiveId ?? tabs[0].id
  const [activeId, setActiveId] = useState(initialId)
  // Every tab that's ever been opened stays mounted (hidden via CSS)
  // afterward instead of unmounting -- rendering only `active.content`
  // used to throw away and rebuild the whole tab's component tree on every
  // switch, re-running its data loads from scratch and reading as "the page
  // refreshing" (see MobileShell's identical visitedTabs fix for the mobile
  // tab bar). Mounted lazily, not all tabs upfront, so a tab nobody has
  // opened yet doesn't fire its effects for nothing.
  const [visitedIds, setVisitedIds] = useState<Set<string>>(() => new Set([initialId]))
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0]

  function selectTab(id: string) {
    setActiveId(id)
    setVisitedIds((current) => (current.has(id) ? current : new Set(current).add(id)))
  }

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
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map(
        (tab) =>
          visitedIds.has(tab.id) && (
            <div key={tab.id} role="tabpanel" hidden={tab.id !== active.id}>
              {tab.content}
            </div>
          ),
      )}
    </div>
  )
}

import type { ReactNode } from 'react'

export interface TabItem {
  key: string
  label: ReactNode
}

interface TabsProps {
  items: TabItem[]
  active: string
  onChange: (key: string) => void
}

export function Tabs({ items, active, onChange }: TabsProps) {
  return (
    <div className="ui-tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.key}
          role="tab"
          aria-selected={item.key === active}
          className={`ui-tab${item.key === active ? ' ui-tab-active' : ''}`}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

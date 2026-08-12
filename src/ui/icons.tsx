/*
  Minimal line-icon set for the five nav areas. Deliberately plain (stroke
  paths, no icon-font dependency) to match the bare-bones design system.
*/

const common = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function DashboardIcon() {
  return (
    <svg {...common}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </svg>
  )
}

export function EventsIcon() {
  return (
    <svg {...common}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4M16 3v4" />
    </svg>
  )
}

export function PlanIcon() {
  return (
    <svg {...common}>
      <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  )
}

export function JournalIcon() {
  return (
    <svg {...common}>
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22.5Z" />
      <path d="M4 4.5v16" />
    </svg>
  )
}

export function AskAtlasIcon() {
  return (
    <svg {...common}>
      <path d="M12 3.5c.5 2.4 1.2 3.9 2.6 5.3 1.4 1.4 2.9 2.1 5.3 2.6-2.4.5-3.9 1.2-5.3 2.6-1.4 1.4-2.1 2.9-2.6 5.3-.5-2.4-1.2-3.9-2.6-5.3C8 12.6 6.5 11.9 4.1 11.4c2.4-.5 3.9-1.2 5.3-2.6C10.8 7.4 11.5 5.9 12 3.5Z" />
      <path d="M19 16.2c.24 1.05.55 1.7 1.14 2.28.58.58 1.24.9 2.28 1.14-1.04.24-1.7.56-2.28 1.14-.59.58-.9 1.24-1.14 2.28-.24-1.04-.56-1.7-1.14-2.28-.58-.58-1.24-.9-2.28-1.14 1.04-.24 1.7-.56 2.28-1.14.58-.58.9-1.23 1.14-2.28Z" />
    </svg>
  )
}

export function SettingsIcon() {
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

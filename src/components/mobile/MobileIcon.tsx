// Shared tactical/outline icon set for mobile chrome. One place so Hub,
// Events, Planner, Journal, Profile, and their overlays/sheets all draw the
// same glyphs instead of each hand-rolling their own <svg> per icon. Path
// data for the newer names is copied verbatim from the Atlas Mobile Claude
// Design mockup's icon set so the app matches it exactly.
export type MobileIconName =
  | 'zap'
  | 'orbit'
  | 'satellite'
  | 'telescope'
  | 'book'
  | 'mountain'
  | 'camera'
  | 'chevron'
  | 'pin'
  | 'moon'
  | 'sun'
  | 'aurora'
  | 'asteroid'
  | 'plane'
  | 'search'
  | 'eye'
  | 'binoculars'
  | 'calendar'
  | 'route'
  | 'journal'
  | 'person'
  | 'bell'
  | 'sparkle'
  | 'trophy'
  | 'users'
  | 'plus'
  | 'close'
  | 'back'
  | 'check'
  | 'cloud'
  | 'lock'
  | 'gear'

export function MobileIcon({ name, size = 18 }: { name: MobileIconName | string; size?: number }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    width: size,
    height: size,
    'aria-hidden': true,
  }
  switch (name) {
    case 'search':
      return (
        <svg {...common}>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m20 20-4.6-4.6" />
        </svg>
      )
    case 'zap':
      return (
        <svg {...common}>
          <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
        </svg>
      )
    case 'orbit':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <ellipse cx="12" cy="12" rx="10" ry="4.2" />
        </svg>
      )
    case 'satellite':
      return (
        <svg {...common}>
          <rect x="9" y="9" width="6" height="6" rx="1" />
          <path d="M4 4l3 3M20 4l-3 3M4 20l3-3M20 20l-3-3M12 9V5M12 19v-4" />
        </svg>
      )
    case 'telescope':
      return (
        <svg {...common}>
          <path d="M3 12l14-6 2 4-14 6-2-4Z" />
          <path d="M13 12l4 8M6 15l-2 5" />
          <circle cx="18" cy="9" r="1.4" />
        </svg>
      )
    case 'book':
      return (
        <svg {...common}>
          <path d="M4 4.5h9l3 3v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z" />
          <path d="M7 9.5h6M7 12.5h6" />
        </svg>
      )
    case 'mountain':
      return (
        <svg {...common}>
          <path d="M3 19 9 8l4 6 2-3 6 8H3Z" />
        </svg>
      )
    case 'camera':
      return (
        <svg {...common}>
          <path d="M4 8h3l2-2h6l2 2h3v11H4V8Z" />
          <circle cx="12" cy="13.5" r="3.5" />
        </svg>
      )
    case 'chevron':
      return (
        <svg {...common}>
          <path d="M9 5.5 15.5 12 9 18.5" />
        </svg>
      )
    case 'pin':
      return (
        <svg {...common}>
          <path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12Z" />
          <circle cx="12" cy="9" r="2.4" />
        </svg>
      )
    case 'moon':
      return (
        <svg {...common}>
          <path d="M18.5 15.5A7 7 0 0 1 8.5 5.5 8 8 0 1 0 18.5 15.5Z" />
        </svg>
      )
    case 'sun':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7" />
        </svg>
      )
    case 'aurora':
      return (
        <svg {...common}>
          <path d="M3 17c2-3 4-5 6-2s4 1 6-2 4-3 6 0" />
          <path d="M3 12c2-3 4-5 6-2s4 1 6-2 4-3 6 0" />
        </svg>
      )
    case 'asteroid':
      return (
        <svg {...common}>
          <path d="M8 4.5 14 4l4.5 3.5.5 5.5-3 5-5.5 1.5L5 16l-1.5-5.5L8 4.5Z" />
          <circle cx="10.5" cy="10" r="1.1" />
          <circle cx="15" cy="13" r="0.8" />
        </svg>
      )
    case 'plane':
      return (
        <svg {...common}>
          <path d="M10.5 3.5 12 2l1.5 1.5-.5 6L19 13v2l-6-2-1 5 2 1.5V21l-2.5-1L9 21v-1.5l2-1.5-1-5-6 2v-2l5.5-3.5-.5-6Z" />
        </svg>
      )
    case 'eye':
      return (
        <svg {...common}>
          <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
          <circle cx="12" cy="12" r="2.6" />
        </svg>
      )
    case 'binoculars':
      return (
        <svg {...common}>
          <path d="M6 4h3l1 5v5a2.5 2.5 0 0 1-5 0V9Z" />
          <path d="M18 4h-3l-1 5v5a2.5 2.5 0 0 0 5 0V9Z" />
          <path d="M10 10h4" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      )
    case 'route':
      return (
        <svg {...common}>
          <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
          <path d="M9 4v14M15 6v14" />
        </svg>
      )
    case 'journal':
      return (
        <svg {...common}>
          <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22.5Z" />
          <path d="M4 4.5v16" />
        </svg>
      )
    case 'person':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.6" />
          <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
        </svg>
      )
    case 'bell':
      return (
        <svg {...common}>
          <path d="M6 9a6 6 0 0 1 12 0c0 4.2 1.2 5.8 2 6.8H4c.8-1 2-2.6 2-6.8Z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
      )
    case 'sparkle':
      return (
        <svg {...common}>
          <path d="M12 3.5c.5 2.4 1.2 3.9 2.6 5.3 1.4 1.4 2.9 2.1 5.3 2.6-2.4.5-3.9 1.2-5.3 2.6-1.4 1.4-2.1 2.9-2.6 5.3-.5-2.4-1.2-3.9-2.6-5.3C8 12.6 6.5 11.9 4.1 11.4c2.4-.5 3.9-1.2 5.3-2.6C10.8 7.4 11.5 5.9 12 3.5Z" />
        </svg>
      )
    case 'trophy':
      return (
        <svg {...common}>
          <path d="M7 4h10v5.5a5 5 0 0 1-10 0V4Z" />
          <path d="M7 6H4.5a2.5 2.5 0 0 0 2.5 3.5M17 6h2.5a2.5 2.5 0 0 1-2.5 3.5" />
          <path d="M12 14.5v3M9 21h6l-.6-3.5H9.6Z" />
        </svg>
      )
    case 'users':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3 20a6 6 0 0 1 12 0" />
          <path d="M16 5.5a3.2 3.2 0 0 1 0 5M17 20a6 6 0 0 0-2-4.4" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      )
    case 'close':
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      )
    case 'back':
      return (
        <svg {...common}>
          <path d="M14.5 5 8 12l6.5 7" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common}>
          <path d="m5 12.5 4.5 4.5L19 7" />
        </svg>
      )
    case 'cloud':
      return (
        <svg {...common}>
          <path d="M7 18a4 4 0 0 1 .6-7.96A5 5 0 0 1 17 10.5a3.75 3.75 0 0 1-.2 7.5Z" />
        </svg>
      )
    case 'lock':
      return (
        <svg {...common}>
          <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
          <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
        </svg>
      )
    case 'gear':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 2.5v2.6M12 18.9v2.6M4.6 4.6l1.9 1.9M17.5 17.5l1.9 1.9M2.5 12h2.6M18.9 12h2.6M4.6 19.4l1.9-1.9M17.5 6.5l1.9-1.9" />
        </svg>
      )
    default:
      return null
  }
}

export function BackIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12.5 4.5 7 10l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

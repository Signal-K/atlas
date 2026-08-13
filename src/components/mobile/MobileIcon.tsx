// Shared tactical/outline icon set for mobile chrome. One place so Plan,
// Events, and any future mobile view draw the same glyphs instead of each
// hand-rolling their own <svg> per icon.
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
  | 'aurora'
  | 'asteroid'
  | 'plane'

export function MobileIcon({ name }: { name: MobileIconName | string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (name) {
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

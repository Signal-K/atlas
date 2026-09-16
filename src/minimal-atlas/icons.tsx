type IconName = 'satellite' | 'moon' | 'orbit' | 'telescope' | 'aurora' | 'zap' | 'book'

const ICON_PATHS: Record<IconName, { d1: string; d2: string; cr: number }> = {
  satellite: {
    d1: 'M10 9h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z',
    d2: 'M4 4l3 3M20 4l-3 3M4 20l3-3M20 20l-3-3M12 9V5M12 19v-4',
    cr: 0,
  },
  moon: { d1: 'M18.5 15.5A7 7 0 0 1 8.5 5.5 8 8 0 1 0 18.5 15.5Z', d2: '', cr: 0 },
  orbit: { d1: 'M2 12a10 4.2 0 1 0 20 0a10 4.2 0 1 0 -20 0', d2: '', cr: 3 },
  telescope: { d1: 'M3 12l14-6 2 4-14 6-2-4Z', d2: 'M13 12l4 8M6 15l-2 5', cr: 0 },
  aurora: { d1: 'M3 17c2-3 4-5 6-2s4 1 6-2 4-3 6 0', d2: 'M3 12c2-3 4-5 6-2s4 1 6-2 4-3 6 0', cr: 0 },
  zap: { d1: 'M13 2 4 14h6l-1 8 9-12h-6l1-8Z', d2: '', cr: 0 },
  book: { d1: 'M4 4.5h9l3 3v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z', d2: 'M7 9.5h6M7 12.5h6', cr: 0 },
}

export function EventGlyph({ icon, size = 19 }: { icon: string; size?: number }) {
  const spec = ICON_PATHS[icon as IconName] ?? ICON_PATHS.zap
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={spec.d1} />
      {spec.d2 && <path d={spec.d2} />}
      {spec.cr > 0 && <circle cx={12} cy={12} r={spec.cr} />}
    </svg>
  )
}

export function IconMenu() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

export function IconBack() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 5 8 12l6.5 7" />
    </svg>
  )
}

export function IconTheme({ dark }: { dark: boolean }) {
  const d = dark
    ? 'M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7M12 7.8a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4Z'
    : 'M18.5 15.5A7 7 0 0 1 8.5 5.5 8 8 0 1 0 18.5 15.5Z'
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

export function IconWatchShield({ filled }: { filled: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21c4.5-2.2 7-5.4 7-9.2V6.4L12 3 5 6.4v5.4c0 3.8 2.5 7 7 9.2Z" />
      <path d="m9.5 12 1.8 1.8L14.8 10" />
    </svg>
  )
}

export function IconChevronRight() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', opacity: 0.35 }}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

export function IconClose() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

export function IconCheck() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  )
}

const NAV_PATHS: Record<string, { d1: string; d2: string; cr: number; ccx?: number; ccy?: number }> = {
  focus: {
    d1: 'M12 3.5c.5 2.4 1.2 3.9 2.6 5.3 1.4 1.4 2.9 2.1 5.3 2.6-2.4.5-3.9 1.2-5.3 2.6-1.4 1.4-2.1 2.9-2.6 5.3-.5-2.4-1.2-3.9-2.6-5.3C8 12.6 6.5 11.9 4.1 11.4c2.4-.5 3.9-1.2 5.3-2.6C10.8 7.4 11.5 5.9 12 3.5Z',
    d2: '',
    cr: 0,
  },
  events: {
    d1: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z',
    d2: 'M3 10h18M8 3v4M16 3v4',
    cr: 0,
  },
  journal: { d1: 'M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22.5Z', d2: 'M4 4.5v16', cr: 0 },
  you: { d1: 'M4.5 20a7.5 7.5 0 0 1 15 0', d2: '', cr: 3.6, ccx: 12, ccy: 8 },
}

export function NavGlyph({ navKey }: { navKey: string }) {
  const spec = NAV_PATHS[navKey] ?? NAV_PATHS.focus
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', opacity: 0.85 }}>
      <path d={spec.d1} />
      {spec.d2 && <path d={spec.d2} />}
      {spec.cr > 0 && <circle cx={spec.ccx ?? 12} cy={spec.ccy ?? 12} r={spec.cr} />}
    </svg>
  )
}

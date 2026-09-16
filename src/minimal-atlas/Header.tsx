import { IconBack, IconMenu, IconTheme } from './icons'

const SCREEN_LABEL: Record<string, string> = {
  focus: 'Upcoming',
  events: 'All events',
  journal: 'Journal',
  you: 'You',
}

export function Header({
  screen,
  detailCat,
  dark,
  onBack,
  onOpenNav,
  onToggleTheme,
}: {
  screen: string
  detailCat: string
  dark: boolean
  onBack: () => void
  onOpenNav: () => void
  onToggleTheme: () => void
}) {
  const inDetail = screen === 'detail'
  return (
    <header
      style={{
        position: 'relative',
        zIndex: 3,
        flex: 'none',
        padding: '56px 16px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'color-mix(in srgb, var(--ak-bg) 78%, transparent)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderBottom: '1px solid var(--ak-line)',
      }}
    >
      {inDetail ? (
        <>
          <button
            type="button"
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 0, padding: '6px 8px 6px 0', margin: 0, color: 'var(--ak-ink)', font: '500 13px var(--ak-font-sans)', cursor: 'pointer' }}
          >
            <IconBack /> Back
          </button>
          <span style={{ flex: 1, font: '500 10.5px var(--ak-font-mono)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ak-muted)', textAlign: 'right' }}>
            {detailCat}
          </span>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onOpenNav}
            aria-label="Open navigation"
            style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 9, background: 'var(--ak-overlay)', border: '1px solid var(--ak-line)', color: 'var(--ak-ink)', cursor: 'pointer', flex: 'none' }}
          >
            <IconMenu />
          </button>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ font: '700 17px var(--ak-font-display)', letterSpacing: '-.01em' }}>Atlas</span>
            <span style={{ font: '500 10.5px var(--ak-font-mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ak-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {SCREEN_LABEL[screen] ?? ''}
            </span>
          </span>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 9, background: 'var(--ak-overlay)', border: '1px solid var(--ak-line)', color: 'var(--ak-ink)', cursor: 'pointer', flex: 'none' }}
          >
            <IconTheme dark={dark} />
          </button>
        </>
      )}
    </header>
  )
}

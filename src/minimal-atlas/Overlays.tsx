import { CATS, CITIES } from './data'
import { IconCheck, IconClose, NavGlyph } from './icons'
import { TextField } from './ui/kit'

const NAV = [
  { key: 'focus', label: 'Upcoming' },
  { key: 'events', label: 'All events' },
  { key: 'journal', label: 'Journal' },
  { key: 'you', label: 'You' },
]

export function NavDrawer({
  open,
  screen,
  city,
  counts,
  showRail,
  onClose,
  onGo,
  onOpenLocation,
  onPickCategory,
}: {
  open: boolean
  screen: string
  city: string
  counts: Record<string, number | string>
  showRail: boolean
  onClose: () => void
  onGo: (key: string) => void
  onOpenLocation: () => void
  onPickCategory: () => void
}) {
  if (!open) return null
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,17,.5)', backdropFilter: 'blur(2px)' }} />
      <nav
        style={{
          position: 'relative',
          width: 268,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'color-mix(in srgb, var(--ak-bg) 94%, transparent)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          borderRight: '1px solid var(--ak-line-strong)',
          padding: '58px 0 22px',
        }}
      >
        <button
          type="button"
          onClick={onOpenLocation}
          style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 14px 4px', padding: '11px 12px', borderRadius: 12, background: 'var(--ak-overlay)', border: '1px solid var(--ak-line)', color: 'inherit', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}
        >
          <span style={{ flex: 'none', width: 7, height: 7, borderRadius: '50%', background: 'var(--ak-teal)', boxShadow: '0 0 0 3px color-mix(in oklch, var(--ak-teal) 22%, transparent)' }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', font: '500 9.5px var(--ak-font-mono)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ak-muted)' }}>Observing from</span>
            <span style={{ display: 'block', fontWeight: 500, fontSize: 14, marginTop: 2 }}>{city}</span>
          </span>
          <span style={{ flex: 'none', opacity: 0.4, fontSize: 11 }}>▾</span>
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '10px 10px 0' }}>
          {NAV.map((n) => {
            const on = screen === n.key
            return (
              <button
                key={n.key}
                type="button"
                onClick={() => onGo(n.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 10, border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', background: on ? 'var(--ak-overlay)' : 'transparent', color: on ? 'var(--ak-ink)' : 'var(--ak-ink-soft)' }}
              >
                <NavGlyph navKey={n.key} />
                <span style={{ flex: 1, fontWeight: 500, fontSize: 14.5 }}>{n.label}</span>
                <span style={{ font: '500 11px var(--ak-font-mono)', opacity: 0.5 }}>{counts[n.key] ?? ''}</span>
              </button>
            )
          })}
        </div>
        {showRail && (
          <>
            <div style={{ margin: '22px 22px 8px', font: '600 9.5px var(--ak-font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ak-muted)' }}>Categories</div>
            <div className="mx-scroll" style={{ flex: 1, minHeight: 0, padding: '0 10px' }}>
              {CATS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={onPickCategory}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', borderRadius: 10, border: 0, background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: 'var(--ak-ink)' }}
                >
                  <i style={{ flex: 'none', width: 6, height: 6, borderRadius: '50%', background: c.hue }} />
                  <span style={{ flex: 1, fontSize: 13.5, color: 'var(--ak-ink-soft)' }}>{c.label}</span>
                  <span style={{ font: '500 11px var(--ak-font-mono)', color: 'var(--ak-muted)' }}>{counts[c.id] ?? 0}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <div style={{ padding: '14px 22px 0', marginTop: 'auto', borderTop: '1px solid var(--ak-line)' }}>
          <span style={{ font: '500 10px var(--ak-font-mono)', letterSpacing: '.1em', color: 'var(--ak-muted)' }}>Synced 4 min ago · offline ready</span>
        </div>
      </nav>
    </div>
  )
}

export function LocationSheet({
  open,
  city,
  onClose,
  onPick,
}: {
  open: boolean
  city: string
  onClose: () => void
  onPick: (name: string) => void
}) {
  if (!open) return null
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,17,.5)' }} />
      <div
        style={{
          position: 'relative',
          background: 'var(--ak-surface)',
          border: '1px solid var(--ak-line)',
          borderBottom: 0,
          borderRadius: 'var(--ak-radius-lg) var(--ak-radius-lg) 0 0',
          padding: '18px 18px 34px',
          maxHeight: '72%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <strong style={{ font: '700 17px var(--ak-font-display)' }}>Observing location</strong>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: 8, background: 'var(--ak-overlay)', border: 0, color: 'inherit', cursor: 'pointer' }}
          >
            <IconClose />
          </button>
        </div>
        <TextField placeholder="Search a town, park or dark-sky site" />
        <div className="mx-scroll" style={{ marginTop: 6, flex: 1, minHeight: 0 }}>
          {CITIES.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => onPick(c.name)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'none', border: 0, borderBottom: '1px solid var(--ak-line)', padding: '13px 2px', margin: 0, textAlign: 'left', fontFamily: 'inherit', color: 'inherit', cursor: 'pointer' }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 500, fontSize: 14.5 }}>{c.name}</span>
                <span style={{ display: 'block', marginTop: 2, font: '500 10.5px var(--ak-font-mono)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ak-muted)' }}>{c.meta}</span>
              </span>
              <span style={{ flex: 'none', color: 'var(--ak-violet-strong)', opacity: c.name === city ? 1 : 0 }}>
                <IconCheck />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

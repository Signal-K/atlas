import { useMemo } from 'react'
import { makeRng, PALETTE, WASH_SPECS } from './data'

export function Starfield({ dark, density = 95 }: { dark: boolean; density?: number }) {
  const { dots, washes } = useMemo(() => {
    const rnd = makeRng(20260901)
    const dots = Array.from({ length: Math.round(density) }, () => {
      const r = rnd()
      const size = r < 0.74 ? 1.2 : r < 0.94 ? 1.8 : 2.6
      return {
        left: `${(rnd() * 100).toFixed(2)}%`,
        top: `${(rnd() * 100).toFixed(2)}%`,
        size: `${size}px`,
        color: PALETTE[Math.floor(rnd() * PALETTE.length)],
        opacity: ((dark ? 0.3 : 0.22) + rnd() * (dark ? 0.36 : 0.26)).toFixed(3),
      }
    })
    const washes = WASH_SPECS.map((w) => ({
      left: w.left,
      top: w.top,
      size: `${w.size}px`,
      bg: `oklch(.7 .16 ${w.hue} / ${dark ? 0.1 : 0.055})`,
    }))
    return { dots, washes }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density, dark])

  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: '-12%', animation: 'atlasDrift 52s linear infinite alternate' }}>
        {washes.map((w, i) => (
          <i
            key={i}
            style={{ position: 'absolute', borderRadius: '50%', filter: 'blur(58px)', left: w.left, top: w.top, width: w.size, height: w.size, background: w.bg }}
          />
        ))}
        {dots.map((d, i) => (
          <i
            key={i}
            style={{ position: 'absolute', borderRadius: '50%', left: d.left, top: d.top, width: d.size, height: d.size, background: d.color, opacity: d.opacity }}
          />
        ))}
      </div>
    </div>
  )
}

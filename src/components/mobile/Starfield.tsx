import { useMemo } from 'react'

// Decorative animated star field, ported from the Atlas Mobile Claude
// Design mockup's buildStarfield(): a seeded PRNG dot field. Deterministic
// per (density, palette, theme) so it doesn't jitter across re-renders.
// Mounted behind Hub, the Event Detail overlay, the Search overlay, and
// onboarding.
//
// The mockup also painted three blurred nebula "wash" circles (violet /
// teal / ember) over the dot field. Those are gone: at blur(60px) and
// 240-300px across they bled colour right across the whole viewport, so
// what should have read as "stars over a night sky" read as "stars over a
// colour gradient". The background behind this field is near-black
// (--bg, #0a0a11) and flat now, which is the intent.
export type StarfieldPalette = 'multicolour' | 'cool' | 'ember' | 'mono'
export type StarfieldMotion = 'drift' | 'static'

const PALETTES: Record<StarfieldPalette, (dark: boolean) => string[]> = {
  multicolour: () => ['oklch(.72 .14 288)', 'oklch(.72 .14 200)', 'oklch(.76 .14 70)', 'oklch(.70 .14 15)', 'oklch(.74 .13 145)'],
  cool: () => ['oklch(.72 .12 250)', 'oklch(.74 .12 210)', 'oklch(.70 .12 288)'],
  ember: () => ['oklch(.76 .13 60)', 'oklch(.72 .13 25)', 'oklch(.74 .10 95)'],
  mono: (dark) => [dark ? 'oklch(.9 .01 280)' : 'oklch(.45 .02 280)'],
}

function makeRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export function Starfield({
  density = 150,
  palette = 'multicolour',
  motion = 'drift',
  dark = false,
}: {
  density?: number
  palette?: StarfieldPalette
  motion?: StarfieldMotion
  dark?: boolean
}) {
  const dots = useMemo(() => {
    const colors = (PALETTES[palette] ?? PALETTES.multicolour)(dark)
    const rnd = makeRng(20260901)
    const n = Math.round(density)
    return Array.from({ length: n }, (_, i) => {
      const r = rnd()
      const size = r < 0.72 ? 1.2 : r < 0.93 ? 2 : 3
      return {
        key: i,
        left: (rnd() * 100).toFixed(2) + '%',
        top: (rnd() * 100).toFixed(2) + '%',
        size,
        color: colors[Math.floor(rnd() * colors.length)],
        opacity: (dark ? 0.42 : 0.3) + rnd() * (dark ? 0.55 : 0.42),
      }
    })
  }, [density, palette, dark])

  return (
    <div className={`az-starfield${motion === 'drift' ? ' is-drift' : ''}`} aria-hidden="true">
      {dots.map((d) => (
        <i
          key={d.key}
          className="az-starfield-dot"
          style={{ left: d.left, top: d.top, width: d.size, height: d.size, background: d.color, opacity: d.opacity }}
        />
      ))}
    </div>
  )
}

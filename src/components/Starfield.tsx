import { useEffect, useRef } from 'react'
import { mulberry32 } from '../lib/rng'
import type { RefObject } from 'react'
import type { ParallaxOffset } from '../lib/motion'

interface Star {
  x: number
  y: number
  radius: number
  baseAlpha: number
  color: [number, number, number]
  twinkleSpeed: number
  phase: number
}

interface StarLayer {
  depth: number // parallax multiplier: 0 = far/still, 1 = near/most responsive
  areaPerStar: number // px^2 per star at 1x device pixel ratio
  sizeRange: [number, number]
  alphaRange: [number, number]
}

interface Smudge {
  x: number
  y: number
  rx: number
  ry: number
  rotation: number
  alpha: number
  color: [number, number, number]
}

const LAYERS: StarLayer[] = [
  { depth: 0.15, areaPerStar: 2200, sizeRange: [0.3, 0.9], alphaRange: [0.4, 0.7] },
  { depth: 0.4, areaPerStar: 4200, sizeRange: [0.7, 1.5], alphaRange: [0.55, 0.9] },
  { depth: 0.85, areaPerStar: 13000, sizeRange: [1.2, 2.7], alphaRange: [0.7, 1] },
]

// Loosely inspired by the star colors visible in Hubble Deep Field imagery:
// mostly white/blue-white points, with occasional warmer yellow/orange/red ones.
// Bright pastel dots read fine against the dark theme's near-black
// background, but are essentially invisible against the light theme's white
// one -- LIGHT_PALETTE swaps in deep, saturated tones instead so the same
// field is still visible when the app is in light mode.
const DARK_PALETTE: Array<{ rgb: [number, number, number]; weight: number }> = [
  { rgb: [255, 255, 255], weight: 50 },
  { rgb: [202, 225, 255], weight: 20 },
  { rgb: [255, 244, 214], weight: 15 },
  { rgb: [255, 210, 161], weight: 10 },
  { rgb: [255, 160, 122], weight: 5 },
]

const LIGHT_PALETTE: Array<{ rgb: [number, number, number]; weight: number }> = [
  { rgb: [76, 29, 149], weight: 30 }, // indigo
  { rgb: [30, 58, 138], weight: 25 }, // navy
  { rgb: [124, 58, 237], weight: 20 }, // violet
  { rgb: [157, 23, 77], weight: 15 }, // deep rose
  { rgb: [51, 65, 85], weight: 10 }, // slate
]

function pickColor(rand: () => number, palette: typeof DARK_PALETTE): [number, number, number] {
  const total = palette.reduce((sum, entry) => sum + entry.weight, 0)
  let r = rand() * total
  for (const entry of palette) {
    if (r < entry.weight) return entry.rgb
    r -= entry.weight
  }
  return palette[0].rgb
}

function isDarkTheme(): boolean {
  const explicit = document.documentElement.dataset.theme
  if (explicit === 'dark') return true
  if (explicit === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function createLayerStars(width: number, height: number, layer: StarLayer, rand: () => number, isDark: boolean): Star[] {
  const count = Math.floor((width * height) / layer.areaPerStar)
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE
  // Saturated colors read as "darker" than white/pastel at the same alpha,
  // so the light-mode palette gets a bit more opacity to stay legible
  // against a white background without looking like a smudged mess.
  const alphaBoost = isDark ? 1 : 1.4
  return Array.from({ length: count }, () => ({
    x: rand() * width,
    y: rand() * height,
    radius: layer.sizeRange[0] + rand() * (layer.sizeRange[1] - layer.sizeRange[0]),
    baseAlpha: Math.min(1, (layer.alphaRange[0] + rand() * (layer.alphaRange[1] - layer.alphaRange[0])) * alphaBoost),
    color: pickColor(rand, palette),
    twinkleSpeed: rand() * 0.015 + 0.004,
    phase: rand() * Math.PI * 2,
  }))
}

// Loosely inspired by real nebula imagery (emission/reflection nebulae
// photographed in narrowband): magenta/rose H-alpha, teal/cyan O-III, warm
// amber dust glow, plus the original pale blue-white for variety. Light mode
// gets more saturated versions of the same hues so the field stays visible
// against a white background.
const DARK_SMUDGE_PALETTE: Array<[number, number, number]> = [
  [220, 225, 255], // pale blue-white
  [255, 130, 190], // magenta/rose (H-alpha)
  [110, 220, 210], // teal/cyan (O-III)
  [255, 190, 120], // warm amber dust
  [170, 140, 255], // violet
]

const LIGHT_SMUDGE_PALETTE: Array<[number, number, number]> = [
  [124, 58, 237], // violet
  [219, 39, 119], // rose
  [13, 148, 136], // teal
  [217, 119, 6], // amber
  [67, 56, 202], // indigo
]

function createSmudges(width: number, height: number, rand: () => number, isDark: boolean): Smudge[] {
  const count = Math.max(4, Math.floor((width * height) / 550_000))
  const palette = isDark ? DARK_SMUDGE_PALETTE : LIGHT_SMUDGE_PALETTE
  return Array.from({ length: count }, () => ({
    x: rand() * width,
    y: rand() * height,
    rx: 55 + rand() * 120,
    ry: 28 + rand() * 65,
    rotation: rand() * Math.PI,
    alpha: 0.07 + rand() * 0.12,
    color: palette[Math.floor(rand() * palette.length)],
  }))
}

function drawSmudge(ctx: CanvasRenderingContext2D, smudge: Smudge, isDark: boolean) {
  ctx.save()
  ctx.translate(smudge.x, smudge.y)
  ctx.rotate(smudge.rotation)
  ctx.scale(smudge.rx, smudge.ry)
  const [r, g, b] = smudge.color
  const alpha = isDark ? smudge.alpha : smudge.alpha * 2.4
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`)
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(0, 0, 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

interface StarfieldProps {
  locationSeed: number
  targetRef: RefObject<ParallaxOffset>
}

export function Starfield({ locationSeed, targetRef }: StarfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    let layerStars: Star[][] = []
    let smudges: Smudge[] = []
    let isDark = isDarkTheme()

    function generate() {
      const canvas = canvasRef.current
      if (!canvas) return
      width = canvas.width = canvas.offsetWidth * window.devicePixelRatio
      height = canvas.height = canvas.offsetHeight * window.devicePixelRatio
      const rand = mulberry32(locationSeed)
      layerStars = LAYERS.map((layer) => createLayerStars(width, height, layer, rand, isDark))
      smudges = createSmudges(width, height, rand, isDark)
    }

    generate()
    window.addEventListener('resize', generate)

    // Re-palette (not full regenerate -- positions stay put) whenever the
    // theme flips, whether via the manual toggle (data-theme attribute) or
    // an OS-level prefers-color-scheme change.
    function handleThemeChange() {
      isDark = isDarkTheme()
      generate()
    }
    const themeObserver = new MutationObserver(handleThemeChange)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
    colorSchemeQuery.addEventListener('change', handleThemeChange)

    let frame = 0
    let rafId = 0
    const current = { x: 0, y: 0 }
    const maxOffset = 40 * window.devicePixelRatio

    function draw() {
      const ctx2 = canvasRef.current?.getContext('2d')
      if (!ctx2) return

      // Smoothed toward the live target so motion/mouse input feels fluid,
      // plus a slow autonomous drift so the field is never fully static.
      current.x += (targetRef.current.x - current.x) * 0.05
      current.y += (targetRef.current.y - current.y) * 0.05
      const driftX = Math.sin(frame * 0.0015) * 0.15
      const driftY = Math.cos(frame * 0.0011) * 0.15

      ctx2.clearRect(0, 0, width, height)

      for (const smudge of smudges) drawSmudge(ctx2, smudge, isDark)

      for (let i = 0; i < LAYERS.length; i += 1) {
        const layer = LAYERS[i]
        const offsetX = (current.x + driftX) * maxOffset * layer.depth
        const offsetY = (current.y + driftY) * maxOffset * layer.depth

        for (const star of layerStars[i]) {
          const twinkle = reduceMotion ? 1 : Math.sin(star.phase + frame * star.twinkleSpeed) * 0.35 + 0.65
          const radius = star.radius * (reduceMotion ? 1 : 0.85 + twinkle * 0.3)
          const [r, g, b] = star.color
          ctx2.beginPath()
          ctx2.arc(star.x + offsetX, star.y + offsetY, radius, 0, Math.PI * 2)
          ctx2.fillStyle = `rgba(${r}, ${g}, ${b}, ${star.baseAlpha * twinkle})`
          ctx2.fill()
        }
      }

      frame += 1
      if (!reduceMotion) {
        rafId = requestAnimationFrame(draw)
      }
    }

    draw()

    return () => {
      window.removeEventListener('resize', generate)
      themeObserver.disconnect()
      colorSchemeQuery.removeEventListener('change', handleThemeChange)
      cancelAnimationFrame(rafId)
    }
  }, [locationSeed, targetRef])

  return <canvas ref={canvasRef} className="starfield" aria-hidden="true" />
}

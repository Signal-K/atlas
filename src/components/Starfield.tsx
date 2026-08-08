import { useEffect, useRef } from 'react'
import { mulberry32 } from '../lib/rng'

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
}

const LAYERS: StarLayer[] = [
  { areaPerStar: 4500, sizeRange: [0.3, 0.8], alphaRange: [0.2, 0.45] },
  { areaPerStar: 9000, sizeRange: [0.6, 1.3], alphaRange: [0.35, 0.7] },
  { areaPerStar: 30000, sizeRange: [1.1, 2.4], alphaRange: [0.55, 1] },
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

function createSmudges(width: number, height: number, rand: () => number): Smudge[] {
  const count = Math.max(2, Math.floor((width * height) / 900_000))
  return Array.from({ length: count }, () => ({
    x: rand() * width,
    y: rand() * height,
    rx: 40 + rand() * 90,
    ry: 20 + rand() * 50,
    rotation: rand() * Math.PI,
    alpha: 0.02 + rand() * 0.03,
  }))
}

function drawSmudge(ctx: CanvasRenderingContext2D, smudge: Smudge, isDark: boolean) {
  ctx.save()
  ctx.translate(smudge.x, smudge.y)
  ctx.rotate(smudge.rotation)
  ctx.scale(smudge.rx, smudge.ry)
  // Same pale-blue glow reads fine on a near-black background but washes
  // out to nothing on white, so light mode uses a deeper violet at higher
  // alpha for the same "nebula smudge" effect.
  const [r, g, b] = isDark ? [220, 225, 255] : [124, 58, 237]
  const alpha = isDark ? smudge.alpha : smudge.alpha * 3
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`)
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(0, 0, 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// Fixed seed -- the field only needs to look like a starfield, not be tied
// to the viewer's actual sky/location (unlike the pre-strip version this
// was ported from, which also drove device-orientation parallax).
const FIELD_SEED = 20260808

export function Starfield() {
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
      const rand = mulberry32(FIELD_SEED)
      layerStars = LAYERS.map((layer) => createLayerStars(width, height, layer, rand, isDark))
      smudges = createSmudges(width, height, rand)
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

    function draw() {
      const ctx2 = canvasRef.current?.getContext('2d')
      if (!ctx2) return

      ctx2.clearRect(0, 0, width, height)

      for (const smudge of smudges) drawSmudge(ctx2, smudge, isDark)

      for (const stars of layerStars) {
        for (const star of stars) {
          const twinkle = reduceMotion ? 1 : Math.sin(star.phase + frame * star.twinkleSpeed) * 0.35 + 0.65
          const radius = star.radius * (reduceMotion ? 1 : 0.85 + twinkle * 0.3)
          const [r, g, b] = star.color
          ctx2.beginPath()
          ctx2.arc(star.x, star.y, radius, 0, Math.PI * 2)
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
  }, [])

  return <canvas ref={canvasRef} className="starfield" aria-hidden="true" />
}

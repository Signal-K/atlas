import { useEffect, useRef } from 'react'
import { mulberry32 } from '../lib/rng'
import { useLocationSeed } from '../lib/geo'
import { useParallax } from '../lib/motion'

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
}

const LAYERS: StarLayer[] = [
  { depth: 0.15, areaPerStar: 4500, sizeRange: [0.3, 0.8], alphaRange: [0.2, 0.45] },
  { depth: 0.4, areaPerStar: 9000, sizeRange: [0.6, 1.3], alphaRange: [0.35, 0.7] },
  { depth: 0.85, areaPerStar: 30000, sizeRange: [1.1, 2.4], alphaRange: [0.55, 1] },
]

// Loosely inspired by the star colors visible in Hubble Deep Field imagery:
// mostly white/blue-white points, with occasional warmer yellow/orange/red ones.
const PALETTE: Array<{ rgb: [number, number, number]; weight: number }> = [
  { rgb: [255, 255, 255], weight: 50 },
  { rgb: [202, 225, 255], weight: 20 },
  { rgb: [255, 244, 214], weight: 15 },
  { rgb: [255, 210, 161], weight: 10 },
  { rgb: [255, 160, 122], weight: 5 },
]

function pickColor(rand: () => number): [number, number, number] {
  const total = PALETTE.reduce((sum, entry) => sum + entry.weight, 0)
  let r = rand() * total
  for (const entry of PALETTE) {
    if (r < entry.weight) return entry.rgb
    r -= entry.weight
  }
  return PALETTE[0].rgb
}

function createLayerStars(width: number, height: number, layer: StarLayer, rand: () => number): Star[] {
  const count = Math.floor((width * height) / layer.areaPerStar)
  return Array.from({ length: count }, () => ({
    x: rand() * width,
    y: rand() * height,
    radius: layer.sizeRange[0] + rand() * (layer.sizeRange[1] - layer.sizeRange[0]),
    baseAlpha: layer.alphaRange[0] + rand() * (layer.alphaRange[1] - layer.alphaRange[0]),
    color: pickColor(rand),
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

function drawSmudge(ctx: CanvasRenderingContext2D, smudge: Smudge) {
  ctx.save()
  ctx.translate(smudge.x, smudge.y)
  ctx.rotate(smudge.rotation)
  ctx.scale(smudge.rx, smudge.ry)
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
  gradient.addColorStop(0, `rgba(220, 225, 255, ${smudge.alpha})`)
  gradient.addColorStop(1, 'rgba(220, 225, 255, 0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(0, 0, 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const locationSeed = useLocationSeed()
  const { targetRef, needsMotionPermission, requestMotionPermission } = useParallax()

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

    function generate() {
      const canvas = canvasRef.current
      if (!canvas) return
      width = canvas.width = canvas.offsetWidth * window.devicePixelRatio
      height = canvas.height = canvas.offsetHeight * window.devicePixelRatio
      const rand = mulberry32(locationSeed)
      layerStars = LAYERS.map((layer) => createLayerStars(width, height, layer, rand))
      smudges = createSmudges(width, height, rand)
    }

    generate()
    window.addEventListener('resize', generate)

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

      for (const smudge of smudges) drawSmudge(ctx2, smudge)

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
      cancelAnimationFrame(rafId)
    }
  }, [locationSeed, targetRef])

  return (
    <>
      <canvas ref={canvasRef} className="starfield" aria-hidden="true" />
      {needsMotionPermission && (
        <button type="button" className="motion-permission" onClick={requestMotionPermission}>
          Enable motion parallax
        </button>
      )}
    </>
  )
}

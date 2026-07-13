import { useEffect, useRef } from 'react'
import { mulberry32 } from '../lib/rng'

interface SkyStar {
  x: number
  y: number
  r: number
  mag: number
  phase: number
  speed: number
}

interface SkyCloud {
  x: number
  y: number
  r: number
  a: number
}

function makeSkyStars(w: number, h: number, count: number, rand: () => number): SkyStar[] {
  return Array.from({ length: count }, () => ({
    x: rand() * w,
    y: rand() * h,
    r: 0.6 + rand() * 1.6,
    mag: rand(),
    phase: rand() * Math.PI * 2,
    speed: 0.01 + rand() * 0.02,
  }))
}

function makeClouds(w: number, h: number, count: number, rand: () => number): SkyCloud[] {
  return Array.from({ length: count }, () => ({
    x: rand() * w,
    y: rand() * h,
    r: (36 + rand() * 60) * (w / 320),
    a: 0.5 + rand() * 0.5,
  }))
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v))
}

interface SkyMapCanvasProps {
  clarity: number // 0-100: 100 = fully clear, 0 = fully clouded
  markerLabel?: string
  seed?: number
}

// The Hub tab's "what does tonight's sky roughly look like" visualization --
// not a real star-chart (no actual RA/dec plotting), just a clarity-driven
// twinkle/cloud density illustration with an optional labeled marker for the
// top tonight target, in the same visual language as the finder-bracket
// reticle used elsewhere in the mockup.
export function SkyMapCanvas({ clarity, markerLabel, seed = 42 }: SkyMapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const clarityRef = useRef(clarity)
  const markerRef = useRef(markerLabel)
  clarityRef.current = clarity
  markerRef.current = markerLabel

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    let stars: SkyStar[] = []
    let clouds: SkyCloud[] = []
    let width = 0
    let height = 0

    function resize() {
      const el = canvasRef.current
      if (!el) return
      width = el.width = el.offsetWidth * dpr
      height = el.height = el.offsetHeight * dpr
      const rand = mulberry32(seed)
      stars = makeSkyStars(width, height, 130, rand)
      clouds = makeClouds(width, height, 4, rand)
    }

    resize()
    window.addEventListener('resize', resize)

    let frame = 0
    let rafId = 0
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function draw() {
      const el = canvasRef.current
      const context = el?.getContext('2d')
      if (!context) return

      const clarityFrac = clarityRef.current / 100
      context.clearRect(0, 0, width, height)

      context.strokeStyle = 'rgba(255,255,255,0.07)'
      context.lineWidth = 1
      for (let gx = 0; gx <= 4; gx += 1) {
        const x = (width / 4) * gx
        context.beginPath()
        context.moveTo(x, 0)
        context.lineTo(x, height)
        context.stroke()
      }
      for (let gy = 0; gy <= 4; gy += 1) {
        const y = (height / 4) * gy
        context.beginPath()
        context.moveTo(0, y)
        context.lineTo(width, y)
        context.stroke()
      }

      const bx = width * 0.32
      const by = height * 0.14
      const bw = width * 0.36
      const bh = height * 0.72
      const br = Math.min(bw, bh) * 0.14
      context.strokeStyle = 'rgba(10,130,179,0.55)'
      context.lineWidth = 1.5
      roundRect(context, bx, by, bw, bh, br)
      context.stroke()

      for (const star of stars) {
        const visibility = clamp((clarityFrac + 0.06 - star.mag) / 0.16, 0, 1)
        if (visibility <= 0.01) continue
        const twinkle = reduceMotion ? 1 : Math.sin(star.phase + frame * star.speed) * 0.3 + 0.7
        context.beginPath()
        context.arc(star.x, star.y, star.r * dpr * (0.8 + twinkle * 0.3), 0, Math.PI * 2)
        context.fillStyle = `rgba(255,255,255,${(0.25 + 0.6 * (1 - star.mag)) * twinkle * visibility})`
        context.fill()
      }

      const cloudAlpha = 1 - clarityFrac
      if (cloudAlpha > 0.02) {
        for (const cloud of clouds) {
          const gradient = context.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.r * dpr)
          gradient.addColorStop(0, `rgba(200,205,215,${cloudAlpha * cloud.a})`)
          gradient.addColorStop(1, 'rgba(200,205,215,0)')
          context.fillStyle = gradient
          context.beginPath()
          context.arc(cloud.x, cloud.y, cloud.r * dpr, 0, Math.PI * 2)
          context.fill()
        }
      }

      const cx = width / 2
      const cy = height / 2
      const cl = 14 * dpr
      context.strokeStyle = 'rgba(224,68,55,0.9)'
      context.lineWidth = 1.5
      context.beginPath()
      context.moveTo(cx - cl, cy)
      context.lineTo(cx + cl, cy)
      context.moveTo(cx, cy - cl)
      context.lineTo(cx, cy + cl)
      context.stroke()
      context.beginPath()
      context.arc(cx, cy, cl * 0.55, 0, Math.PI * 2)
      context.stroke()

      if (markerRef.current) {
        const ox = bx + bw * 0.62
        const oy = by + bh * 0.22
        context.beginPath()
        context.arc(ox, oy, 3.5 * dpr, 0, Math.PI * 2)
        context.strokeStyle = 'rgba(56,189,248,0.9)'
        context.lineWidth = 1.5
        context.stroke()
        context.fillStyle = 'rgba(255,255,255,0.9)'
        context.font = `${11 * dpr}px inherit`
        context.fillText(markerRef.current, ox + 8 * dpr, oy + 4 * dpr)
      }

      frame += 1
      if (!reduceMotion) rafId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(rafId)
    }
  }, [seed])

  return <canvas ref={canvasRef} className="sky-map-canvas" aria-hidden="true" />
}

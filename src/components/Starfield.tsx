import { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  radius: number
  baseAlpha: number
  twinkleSpeed: number
  phase: number
}

function createStars(width: number, height: number, count: number): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: Math.random() * 1.3 + 0.3,
    baseAlpha: Math.random() * 0.5 + 0.3,
    twinkleSpeed: Math.random() * 0.015 + 0.005,
    phase: Math.random() * Math.PI * 2,
  }))
}

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let stars: Star[] = []
    let width = 0
    let height = 0

    function resize() {
      const canvas = canvasRef.current
      if (!canvas) return
      width = canvas.width = canvas.offsetWidth * window.devicePixelRatio
      height = canvas.height = canvas.offsetHeight * window.devicePixelRatio
      const density = 9000
      stars = createStars(width, height, Math.floor((width * height) / density))
    }

    resize()
    window.addEventListener('resize', resize)

    let frame = 0
    let rafId: number

    function draw() {
      const ctx2 = canvasRef.current?.getContext('2d')
      if (!ctx2) return
      ctx2.clearRect(0, 0, width, height)
      const starColor = getComputedStyle(document.documentElement).getPropertyValue('--star').trim() || '226, 232, 240'
      for (const star of stars) {
        const twinkle = reduceMotion ? 1 : Math.sin(star.phase + frame * star.twinkleSpeed) * 0.35 + 0.65
        ctx2.beginPath()
        ctx2.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
        ctx2.fillStyle = `rgba(${starColor}, ${star.baseAlpha * twinkle})`
        ctx2.fill()
      }
      frame += 1
      if (!reduceMotion) {
        rafId = requestAnimationFrame(draw)
      }
    }

    draw()

    return () => {
      window.removeEventListener('resize', resize)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  return <canvas ref={canvasRef} className="starfield" aria-hidden="true" />
}

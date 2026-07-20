import { useEffect, useRef } from 'react'
import * as Astronomy from 'astronomy-engine'
import { getSkyMapObjects, type SkyMapObject } from '../lib/skyMapLayers'
import type { DevicePointing } from '../lib/deviceCompass'
import { getHorizontalPosition, type HorizontalPosition } from '../lib/skyPosition'

interface SkyCloud {
  x: number
  y: number
  r: number
  a: number
}

function makeClouds(w: number, h: number, count: number): SkyCloud[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: (36 + Math.random() * 60) * (w / 320),
    a: 0.5 + Math.random() * 0.5,
  }))
}

interface SkyMapCanvasProps {
  clarity: number // 0-100: 100 = fully clear, 0 = fully clouded
  date?: Date
  lat: number
  lon: number
  markerLabel?: string
  markerPosition?: HorizontalPosition | null
  selectedObjectId?: string | null
  pointing?: DevicePointing | null
  presentation?: 'preview' | 'full'
  onObjectSelect?: (object: SkyMapObject) => void
}

function projectSky(altitudeDeg: number, azimuthDeg: number, cx: number, cy: number, radius: number) {
  const horizonDistance = (90 - altitudeDeg) / 90
  const theta = (azimuthDeg - 90) * (Math.PI / 180)
  const r = radius * horizonDistance
  return {
    x: cx + Math.cos(theta) * r,
    y: cy + Math.sin(theta) * r,
  }
}

function projectPreview(altitudeDeg: number, azimuthDeg: number, width: number, height: number) {
  const x = (azimuthDeg / 360) * width
  const y = height * (0.88 - clamp(altitudeDeg, 0, 90) / 125)
  return {
    x: clamp(x, width * 0.06, width * 0.94),
    y: clamp(y, height * 0.14, height * 0.9),
  }
}

function transformPointForSelection<T extends { x: number; y: number }>(point: T, selectedPoint: { x: number; y: number } | null, cx: number, cy: number): T {
  if (!selectedPoint) return point
  const zoom = 1.55
  return {
    ...point,
    x: cx + (point.x - selectedPoint.x) * zoom,
    y: cy + (point.y - selectedPoint.y) * zoom,
  }
}

function objectColor(object: SkyMapObject): string {
  if (object.kind === 'star') return '#eef2e6'
  if (object.kind === 'sun') return '#f2b37d'
  if (object.kind === 'moon') return '#f1ead2'
  if (object.kind === 'planet') return '#7dd3fc'
  return object.objectType?.includes('nebula') ? '#ff7062' : '#c7d2fe'
}

function objectRadius(object: SkyMapObject, dpr: number): number {
  if (object.kind === 'star') return Math.max(1.1, 3.6 - (object.magnitude ?? 2) * 0.55) * dpr
  if (object.kind === 'sun') return 5.5 * dpr
  if (object.kind === 'moon') return 6 * dpr
  if (object.kind === 'planet') return Math.max(2.2, 5.5 - (object.magnitude ?? 3) * 0.55) * dpr
  if (object.objectType?.includes('nebula')) return 3.8 * dpr
  return 3 * dpr
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v))
}

function isLightTheme(): boolean {
  const explicit = document.documentElement.dataset.theme
  if (explicit === 'light') return true
  if (explicit === 'dark') return false
  return !window.matchMedia('(prefers-color-scheme: dark)').matches
}

function skyTone(sunAltitudeDeg: number, lightTheme: boolean) {
  if (!lightTheme) {
    return {
      center: 'rgba(78,105,170,0.20)',
      mid: 'rgba(7,13,30,0.52)',
      edge: 'rgba(1,5,14,0.94)',
      previewStart: 'rgba(8,18,42,0.96)',
      previewMid: 'rgba(13,27,58,0.86)',
      previewEnd: 'rgba(2,6,17,0.98)',
      grid: 'rgba(124,196,255,0.16)',
      ray: 'rgba(124,196,255,0.14)',
      label: 'rgba(238,242,230,0.86)',
    }
  }

  if (sunAltitudeDeg > 6) {
    return {
      center: 'rgba(186,225,255,0.96)',
      mid: 'rgba(125,190,235,0.88)',
      edge: 'rgba(63,126,184,0.78)',
      previewStart: 'rgba(191,226,255,0.96)',
      previewMid: 'rgba(119,186,232,0.88)',
      previewEnd: 'rgba(58,112,168,0.86)',
      grid: 'rgba(15,82,125,0.24)',
      ray: 'rgba(15,82,125,0.18)',
      label: 'rgba(15,38,58,0.82)',
    }
  }

  if (sunAltitudeDeg > -6) {
    return {
      center: 'rgba(244,181,120,0.78)',
      mid: 'rgba(112,154,214,0.74)',
      edge: 'rgba(42,73,128,0.78)',
      previewStart: 'rgba(246,190,128,0.86)',
      previewMid: 'rgba(104,147,211,0.78)',
      previewEnd: 'rgba(31,54,105,0.86)',
      grid: 'rgba(39,80,135,0.24)',
      ray: 'rgba(39,80,135,0.18)',
      label: 'rgba(20,32,54,0.84)',
    }
  }

  return {
    center: 'rgba(80,112,179,0.48)',
    mid: 'rgba(20,43,88,0.72)',
    edge: 'rgba(4,13,32,0.92)',
    previewStart: 'rgba(28,48,99,0.94)',
    previewMid: 'rgba(15,31,70,0.90)',
    previewEnd: 'rgba(4,12,31,0.96)',
    grid: 'rgba(124,196,255,0.20)',
    ray: 'rgba(124,196,255,0.16)',
    label: 'rgba(236,242,255,0.86)',
  }
}

function estimatePointingAltitude(pitchDeg: number | null): number {
  if (pitchDeg == null) return 0
  // DeviceOrientation beta is not a true camera optical-axis altitude, but
  // this maps common phone postures usefully: flat screen-up ~= zenith,
  // upright portrait ~= horizon. A calibration pass should replace this.
  return clamp(90 - Math.abs(pitchDeg), 0, 90)
}

function angularDeltaDeg(a: number, b: number): number {
  return Math.abs((((a - b + 180) % 360) + 360) % 360 - 180)
}

// Real observer-based sky map. Stars will move to a generated catalog next;
// solar-system and curated deep-sky objects already use real alt/az positions.
export function SkyMapCanvas({
  clarity,
  date,
  lat,
  lon,
  markerLabel,
  markerPosition,
  selectedObjectId,
  pointing,
  presentation = 'full',
  onObjectSelect,
}: SkyMapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const clarityRef = useRef(clarity)
  const dateRef = useRef(date)
  const markerRef = useRef(markerLabel)
  const markerPositionRef = useRef(markerPosition)
  const selectedObjectIdRef = useRef(selectedObjectId)
  const pointingRef = useRef(pointing)
  const onObjectSelectRef = useRef(onObjectSelect)
  clarityRef.current = clarity
  dateRef.current = date
  markerRef.current = markerLabel
  markerPositionRef.current = markerPosition
  selectedObjectIdRef.current = selectedObjectId
  pointingRef.current = pointing
  onObjectSelectRef.current = onObjectSelect

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    let clouds: SkyCloud[] = []
    let objects: SkyMapObject[] = []
    let width = 0
    let height = 0
    let lastObjectRefresh = 0
    let lightTheme = isLightTheme()
    let hitTargets: Array<{ object: SkyMapObject; x: number; y: number; radius: number }> = []

    function refreshObjects() {
      objects = getSkyMapObjects(dateRef.current ?? new Date(), lat, lon).filter((object) => object.visible)
      lastObjectRefresh = Date.now()
    }

    function resize() {
      const el = canvasRef.current
      if (!el) return
      width = el.width = el.offsetWidth * dpr
      height = el.height = el.offsetHeight * dpr
      clouds = makeClouds(width, height, 4)
      refreshObjects()
    }

    resize()
    window.addEventListener('resize', resize)
    function handleClick(event: MouseEvent) {
      if (presentation !== 'full') return
      const activeCanvas = canvasRef.current
      if (!activeCanvas) return
      const rect = activeCanvas.getBoundingClientRect()
      const x = (event.clientX - rect.left) * dpr
      const y = (event.clientY - rect.top) * dpr
      const nearest = hitTargets
        .map((target) => ({ ...target, distance: Math.hypot(target.x - x, target.y - y) }))
        .filter((target) => target.distance <= target.radius)
        .sort((a, b) => a.distance - b.distance)[0]
      if (nearest) onObjectSelectRef.current?.(nearest.object)
    }
    canvas.addEventListener('click', handleClick)

    let frame = 0
    let rafId = 0
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function draw() {
      const el = canvasRef.current
      const context = el?.getContext('2d')
      if (!context) return

      const clarityFrac = clarityRef.current / 100
      context.clearRect(0, 0, width, height)

      if (Date.now() - lastObjectRefresh > 60_000) {
        refreshObjects()
      }

      const cx = width / 2
      const cy = height / 2
      const radius = Math.min(width, height) * (presentation === 'preview' ? 0.48 : 0.49)
      const renderDate = dateRef.current ?? new Date()
      const sunAltitudeDeg = getHorizontalPosition(Astronomy.Body.Sun, renderDate, lat, lon).altitudeDeg
      const tone = skyTone(sunAltitudeDeg, lightTheme)
      const selectedObject = selectedObjectIdRef.current ? objects.find((object) => object.id === selectedObjectIdRef.current) ?? null : null
      const selectedPoint =
        presentation === 'full' && selectedObject
          ? projectSky(selectedObject.altitudeDeg, selectedObject.azimuthDeg, cx, cy, radius)
          : null
      hitTargets = []

      if (presentation === 'preview') {
        const wideGradient = context.createLinearGradient(0, 0, width, height)
        wideGradient.addColorStop(0, tone.previewStart)
        wideGradient.addColorStop(0.42, tone.previewMid)
        wideGradient.addColorStop(1, tone.previewEnd)
        context.fillStyle = wideGradient
        context.fillRect(0, 0, width, height)

        const glow = context.createRadialGradient(width * 0.72, height * 0.44, 0, width * 0.72, height * 0.44, width * 0.5)
        glow.addColorStop(0, 'rgba(245,158,11,0.16)')
        glow.addColorStop(0.42, 'rgba(59,130,246,0.10)')
        glow.addColorStop(1, 'rgba(1,5,14,0)')
        context.fillStyle = glow
        context.fillRect(0, 0, width, height)
      } else {
        const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.72)
        gradient.addColorStop(0, tone.center)
        gradient.addColorStop(0.52, tone.mid)
        gradient.addColorStop(1, tone.edge)
        context.fillStyle = gradient
        context.fillRect(0, 0, width, height)
      }

      if (presentation === 'full') {
        context.strokeStyle = tone.grid
        context.lineWidth = 1 * dpr
        for (const ring of [0.33, 0.66, 1]) {
          context.beginPath()
          context.arc(cx, cy, radius * ring, 0, Math.PI * 2)
          context.stroke()
        }
      }

      if (presentation === 'full') {
        context.strokeStyle = tone.ray
        for (let az = 0; az < 360; az += 45) {
          const edge = transformPointForSelection(projectSky(0, az, cx, cy, radius), selectedPoint, cx, cy)
          context.beginPath()
          context.moveTo(cx, cy)
          context.lineTo(edge.x, edge.y)
          context.stroke()
        }
      }

      if (presentation === 'full') {
        context.fillStyle = tone.label
        context.font = `${10 * dpr}px ui-monospace, monospace`
        context.textAlign = 'center'
        context.fillText('N', cx, cy - radius - 8 * dpr)
        context.fillText('E', cx + radius + 10 * dpr, cy + 3 * dpr)
        context.fillText('S', cx, cy + radius + 16 * dpr)
        context.fillText('W', cx - radius - 10 * dpr, cy + 3 * dpr)
      }

      const routeObjects = objects
        .filter((object) => object.kind === 'star' && (object.magnitude ?? 9) < 1.2)
        .slice(0, 5)
        .map((object) =>
          presentation === 'preview'
            ? projectPreview(object.altitudeDeg, object.azimuthDeg, width, height)
            : transformPointForSelection(projectSky(object.altitudeDeg, object.azimuthDeg, cx, cy, radius), selectedPoint, cx, cy),
        )
      if (presentation === 'preview' && routeObjects.length > 2) {
        context.strokeStyle = 'rgba(93,150,255,0.28)'
        context.lineWidth = 1.2 * dpr
        context.beginPath()
        routeObjects.forEach((point, index) => {
          if (index === 0) context.moveTo(point.x, point.y)
          else context.lineTo(point.x, point.y)
        })
        context.stroke()
      }

      for (const object of objects) {
        const point =
          presentation === 'preview'
            ? projectPreview(object.altitudeDeg, object.azimuthDeg, width, height)
            : transformPointForSelection(projectSky(object.altitudeDeg, object.azimuthDeg, cx, cy, radius), selectedPoint, cx, cy)
        const color = objectColor(object)
        const size = objectRadius(object, dpr) * (presentation === 'preview' ? 1.18 : 1)
        const selected = object.id === selectedObjectIdRef.current
        const pulse = presentation === 'preview' || reduceMotion ? 1 : 0.82 + Math.sin(frame * 0.018 + object.azimuthDeg) * 0.18
        if (presentation === 'full') {
          hitTargets.push({ object, x: point.x, y: point.y, radius: Math.max(18 * dpr, size * 3) })
        }
        if (selected) {
          context.beginPath()
          context.arc(point.x, point.y, size * 3.2, 0, Math.PI * 2)
          context.strokeStyle = 'rgba(56,189,248,0.84)'
          context.lineWidth = 1.5 * dpr
          context.stroke()
        }
        context.beginPath()
        context.arc(point.x, point.y, size * (selected ? 1.55 : pulse), 0, Math.PI * 2)
        context.fillStyle = color
        context.globalAlpha = object.kind === 'deep_sky' || object.kind === 'star' ? (presentation === 'preview' ? 0.76 : 0.68) * clarityFrac : 0.92
        context.fill()
        context.globalAlpha = 1

        if (presentation === 'preview') continue

        const shouldLabel =
          object.kind === 'moon' ||
          object.kind === 'sun' ||
          (object.kind === 'planet' && (object.magnitude ?? 9) < 1.7) ||
          (object.kind === 'deep_sky' && (object.magnitude ?? 9) < 3.8)

        if (shouldLabel) {
          context.fillStyle = tone.label
          context.font = `${9 * dpr}px ui-monospace, monospace`
          context.textAlign = 'left'
          context.fillText(object.name, point.x + 7 * dpr, point.y + 3 * dpr)
        } else if (object.kind === 'star' && (object.magnitude ?? 9) < 0.15) {
          context.fillStyle = tone.label
          context.font = `${8 * dpr}px ui-monospace, monospace`
          context.textAlign = 'left'
          context.fillText(object.name, point.x + 5 * dpr, point.y + 3 * dpr)
        }
      }

      const marker = markerPositionRef.current
      if (marker && marker.altitudeDeg > 0) {
        const point =
          presentation === 'preview'
            ? projectPreview(marker.altitudeDeg, marker.azimuthDeg, width, height)
            : transformPointForSelection(projectSky(marker.altitudeDeg, marker.azimuthDeg, cx, cy, radius), selectedPoint, cx, cy)
        const cl = 12 * dpr
        context.strokeStyle = 'rgba(255,112,98,0.94)'
        context.lineWidth = 1.5 * dpr
        context.beginPath()
        context.moveTo(point.x - cl, point.y)
        context.lineTo(point.x + cl, point.y)
        context.moveTo(point.x, point.y - cl)
        context.lineTo(point.x, point.y + cl)
        context.stroke()
        context.beginPath()
        context.arc(point.x, point.y, cl * 0.55, 0, Math.PI * 2)
        context.stroke()
        if (markerRef.current) {
          context.fillStyle = tone.label
          context.font = `${(presentation === 'preview' ? 9 : 10) * dpr}px ui-monospace, monospace`
          context.textAlign = 'left'
          context.fillText(presentation === 'preview' ? 'TONIGHT' : markerRef.current, point.x + 14 * dpr, point.y - 8 * dpr)
        }
      }

      const devicePointing = pointingRef.current
      if (presentation === 'full' && devicePointing?.headingDeg != null) {
        const estimatedAltitude = estimatePointingAltitude(devicePointing.pitchDeg)
        const nearestPointedObject = objects
          .filter((object) => object.visible && object.kind !== 'sun')
          .map((object) => ({
            object,
            distance:
              angularDeltaDeg(object.azimuthDeg, devicePointing.headingDeg ?? 0) +
              Math.abs(object.altitudeDeg - estimatedAltitude) * 0.85,
          }))
          .sort((a, b) => a.distance - b.distance)[0]?.object
        const point = transformPointForSelection(projectSky(estimatedAltitude, devicePointing.headingDeg, cx, cy, radius), selectedPoint, cx, cy)
        const coneLeft = transformPointForSelection(projectSky(Math.max(0, estimatedAltitude - 4), devicePointing.headingDeg - 7, cx, cy, radius), selectedPoint, cx, cy)
        const coneRight = transformPointForSelection(projectSky(Math.max(0, estimatedAltitude - 4), devicePointing.headingDeg + 7, cx, cy, radius), selectedPoint, cx, cy)
        const roll = ((devicePointing.rollDeg ?? 0) * Math.PI) / 180

        context.fillStyle = 'rgba(45,212,191,0.12)'
        context.beginPath()
        context.moveTo(cx, cy)
        context.lineTo(coneLeft.x, coneLeft.y)
        context.lineTo(coneRight.x, coneRight.y)
        context.closePath()
        context.fill()

        context.strokeStyle = 'rgba(45,212,191,0.72)'
        context.lineWidth = 1.2 * dpr
        context.beginPath()
        context.moveTo(cx, cy)
        context.lineTo(point.x, point.y)
        context.stroke()

        context.save()
        context.translate(point.x, point.y)
        context.rotate(roll)
        context.strokeStyle = 'rgba(45,212,191,0.98)'
        context.fillStyle = 'rgba(45,212,191,0.18)'
        context.lineWidth = 1.7 * dpr
        context.beginPath()
        context.arc(0, 0, 11 * dpr, 0, Math.PI * 2)
        context.fill()
        context.beginPath()
        context.moveTo(0, -13 * dpr)
        context.lineTo(13 * dpr, 0)
        context.lineTo(0, 13 * dpr)
        context.lineTo(-13 * dpr, 0)
        context.closePath()
        context.stroke()
        context.beginPath()
        context.arc(0, 0, 2.6 * dpr, 0, Math.PI * 2)
        context.fillStyle = 'rgba(238,242,230,0.98)'
        context.fill()
        context.restore()

        const label = nearestPointedObject ? `PHONE AIM: ${nearestPointedObject.name}` : 'PHONE AIM'
        context.font = `${10 * dpr}px ui-monospace, monospace`
        const labelWidth = context.measureText(label).width
        const labelX = clamp(point.x + 14 * dpr, 8 * dpr, width - labelWidth - 16 * dpr)
        const labelY = clamp(point.y - 18 * dpr, 18 * dpr, height - 8 * dpr)
        context.fillStyle = 'rgba(1,5,14,0.74)'
        context.fillRect(labelX - 6 * dpr, labelY - 12 * dpr, labelWidth + 12 * dpr, 18 * dpr)
        context.fillStyle = 'rgba(188,245,238,0.94)'
        context.textAlign = 'left'
        context.fillText(label, labelX, labelY)
      }

      const cloudAlpha = 1 - clarityFrac
      if (presentation === 'full' && cloudAlpha > 0.02) {
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

      frame += 1
      if (!reduceMotion) rafId = requestAnimationFrame(draw)
    }

    draw()
    function handleThemeChange() {
      lightTheme = isLightTheme()
      if (reduceMotion) draw()
    }
    const themeObserver = new MutationObserver(handleThemeChange)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
    colorSchemeQuery.addEventListener('change', handleThemeChange)

    return () => {
      window.removeEventListener('resize', resize)
      canvasRef.current?.removeEventListener('click', handleClick)
      themeObserver.disconnect()
      colorSchemeQuery.removeEventListener('change', handleThemeChange)
      cancelAnimationFrame(rafId)
    }
  }, [date?.getTime(), lat, lon, presentation, selectedObjectId])

  return <canvas ref={canvasRef} className="sky-map-canvas" aria-hidden="true" />
}

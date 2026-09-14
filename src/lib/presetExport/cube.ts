// .cube 3D LUT exporter (KES-297). The .cube format is a public,
// industry-standard color-grading file (Iridas/Adobe/DaVinci Resolve spec),
// not a Nothing-proprietary format -- Nothing OS (Phone 3/3a onward) just
// happens to import it natively via Camera app -> Filter -> Import LUT.
//
// Only the `look` half of a preset (LookSettings) maps onto a LUT. `capture`
// parameters (ISO, exposure, mode, lens) are camera-hardware controls, not a
// pixel transform, so they stay a manual checklist -- see KES-295/KES-302.
import type { LookSettings } from '../db'

export type CubeLutSize = 17 | 33

export interface CubeLutOptions {
  size?: CubeLutSize
  title?: string
}

interface Rgb {
  r: number
  g: number
  b: number
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

// Piecewise-linear interpolation through the preset's tone curve control
// points (0-255 in, 0-255 out), applied identically per channel. Anchors at
// (0,0)/(255,255) are added if the author's points don't already reach the
// ends, so the curve never clips the extremes unless deliberately authored to.
function applyToneCurve(value: number, points: Array<[number, number]>): number {
  if (points.length === 0) return value
  const sorted = [...points].sort((a, b) => a[0] - b[0])
  const withAnchors: Array<[number, number]> = []
  if (sorted[0][0] > 0) withAnchors.push([0, 0])
  withAnchors.push(...sorted)
  if (sorted[sorted.length - 1][0] < 255) withAnchors.push([255, 255])

  const x = value * 255
  for (let i = 0; i < withAnchors.length - 1; i++) {
    const [x0, y0] = withAnchors[i]
    const [x1, y1] = withAnchors[i + 1]
    if (x >= x0 && x <= x1) {
      const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0)
      return clamp01((y0 + t * (y1 - y0)) / 255)
    }
  }
  return value
}

// Approximates a full color-grade pipeline as a per-pixel transform so it can
// be baked into a LUT: white balance -> contrast -> highlight/shadow
// weighting -> saturation -> tone curve. This ordering matches common
// color-grading pipelines (correct color temperature before adjusting
// tonal contrast, finish with a curve) -- it's a deliberate approximation of
// each device's real ISP pipeline, not a device-accurate simulation.
function transform(input: Rgb, look: LookSettings): Rgb {
  let { r, g, b } = input

  // White balance: temperatureShiftKelvin warms/cools (positive = warmer,
  // more red/less blue); tint shifts green/magenta (positive = magenta).
  const warmth = (look.temperatureShiftKelvin ?? 0) / 1000
  const tint = (look.tint ?? 0) / 1000
  r += warmth
  b -= warmth
  g -= tint
  r += tint / 2
  b += tint / 2

  // Contrast: -100..100 -> factor 0..2 pivoting around mid-gray.
  const contrastFactor = 1 + (look.contrast ?? 0) / 100
  r = (r - 0.5) * contrastFactor + 0.5
  g = (g - 0.5) * contrastFactor + 0.5
  b = (b - 0.5) * contrastFactor + 0.5

  // Highlights/shadows: weight the adjustment by luminance so shadow lifts
  // don't wash out highlights and vice versa. Positive shadows = lifted
  // (brighter) shadows; positive highlights = brighter highlights.
  const luminance = clamp01(0.2126 * r + 0.7152 * g + 0.0722 * b)
  const shadowWeight = (1 - luminance) ** 2
  const highlightWeight = luminance ** 2
  const shadowAdjust = ((look.shadows ?? 0) / 100) * 0.5 * shadowWeight
  const highlightAdjust = ((look.highlights ?? 0) / 100) * 0.5 * highlightWeight
  r += shadowAdjust + highlightAdjust
  g += shadowAdjust + highlightAdjust
  b += shadowAdjust + highlightAdjust

  // Saturation: -100..100 -> factor 0..2, mixed against luminance.
  const saturationFactor = 1 + (look.saturation ?? 0) / 100
  const satLuminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  r = satLuminance + (r - satLuminance) * saturationFactor
  g = satLuminance + (g - satLuminance) * saturationFactor
  b = satLuminance + (b - satLuminance) * saturationFactor

  if (look.toneCurve?.length) {
    r = applyToneCurve(r, look.toneCurve)
    g = applyToneCurve(g, look.toneCurve)
    b = applyToneCurve(b, look.toneCurve)
  }

  return { r: clamp01(r), g: clamp01(g), b: clamp01(b) }
}

function formatComponent(value: number): string {
  return value.toFixed(6)
}

// Generates a .cube 3D LUT file from a preset's look settings. Row order
// follows the .cube spec: red varies fastest, then green, then blue slowest.
export function generateCubeLut(look: LookSettings, options: CubeLutOptions = {}): string {
  const size = options.size ?? 33
  const title = options.title ?? 'Atlas Preset'
  const lines: string[] = [`TITLE "${title.replace(/"/g, "'")}"`, `LUT_3D_SIZE ${size}`]

  for (let bi = 0; bi < size; bi++) {
    for (let gi = 0; gi < size; gi++) {
      for (let ri = 0; ri < size; ri++) {
        const input: Rgb = {
          r: ri / (size - 1),
          g: gi / (size - 1),
          b: bi / (size - 1),
        }
        const output = transform(input, look)
        lines.push(`${formatComponent(output.r)} ${formatComponent(output.g)} ${formatComponent(output.b)}`)
      }
    }
  }

  return lines.join('\n') + '\n'
}

export interface MoonDiscOptions {
  cx: number
  cy: number
  r: number
  /** 0 (new) .. 1 (full). Values outside the range are clamped. */
  illuminatedFraction: number
  /** True between new and full. Determines which limb is lit. */
  waxing?: boolean
  /** Mirrors the lit limb for observers south of the equator. */
  southernHemisphere?: boolean
}

/** SVG path `d` for the illuminated portion of the disc. */
export function moonLitPath(options: MoonDiscOptions): string

/** Fraction of the disc's area the path encloses; equals the illuminated fraction. */
export function litAreaFraction(illuminatedFraction: number): number

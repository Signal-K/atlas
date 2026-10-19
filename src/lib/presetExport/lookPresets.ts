// Baseline color-grade look per target (KES-297). Atlas doesn't yet author
// per-target/per-device "look" data anywhere else -- CAMERA_RECIPES only has
// capture prose (mode/lens/exposure/focus). These are a reasonable
// astrophotography-style starting grade (lift shadow detail, tame blown
// highlights, modest contrast) so the .cube export has a visible, useful
// effect on import rather than shipping an identity LUT. Open item: replace
// with real per-target grading input once available; the shape (LookSettings)
// doesn't need to change either way.
import type { LookSettings } from '../db'
import type { RecipeKey } from '../cameraRecipes'

export const RECIPE_LOOK_PRESETS: Record<RecipeKey, LookSettings> = {
  moon: { contrast: 25, saturation: -10, highlights: -25, shadows: -10, temperatureShiftKelvin: -150 },
  bright_planet: { contrast: 20, saturation: -5, highlights: -20, shadows: -5, temperatureShiftKelvin: -100 },
  iss_pass: { contrast: 15, saturation: 0, highlights: -10, shadows: 10 },
  meteor_shower: { contrast: 12, saturation: 10, highlights: -10, shadows: 18, temperatureShiftKelvin: -50 },
  conjunction: { contrast: 15, saturation: 5, highlights: -10, shadows: 10 },
  eclipse: { contrast: 20, saturation: -5, highlights: -30, shadows: 0 },
  twilight: { contrast: 10, saturation: 15, highlights: -15, shadows: 5, temperatureShiftKelvin: 100, tint: 5 },
  milky_way: { contrast: 18, saturation: 20, highlights: -5, shadows: 20, temperatureShiftKelvin: -80, tint: -5 },
  starry_sky: { contrast: 15, saturation: 10, highlights: -10, shadows: 15, temperatureShiftKelvin: -60 },
}

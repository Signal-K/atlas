// Target-specific phone camera recipes (AT epic 2, task 2). Field notes, not
// an article: mode/lens/tripod/exposure/focus per device, plus one shared
// composition tip and one honest "expected result" per target type.
import { CAMERA_PROFILES, type DeviceId, type RecipeFamily } from './cameraProfiles'

export type RecipeKey = 'moon' | 'bright_planet' | 'iss_pass' | 'meteor_shower' | 'conjunction' | 'eclipse' | 'twilight' | 'milky_way'

export type TripodRequirement = 'required' | 'recommended' | 'optional'

export interface DeviceRecipe {
  mode: string
  lens: string
  tripod: TripodRequirement
  exposure: string
  focus: string
}

export interface CameraRecipeEntry {
  title: string
  compositionTip: string
  expectedResult: string
  devices: Partial<Record<RecipeFamily, DeviceRecipe>> & { other: DeviceRecipe }
}

export const CAMERA_RECIPES: Record<RecipeKey, CameraRecipeEntry> = {
  moon: {
    title: 'Moon',
    compositionTip: "Fill about a third of the frame — don't dead-center it — and include a foreground silhouette for scale on wide shots.",
    expectedResult: "A bright, detailed lunar disc with visible maria, and craters near the terminator on close shots.",
    devices: {
      apple: {
        mode: 'Photographic Styles off, 5x telephoto + digital zoom to ~15x',
        lens: 'Telephoto (5x)',
        tripod: 'recommended',
        exposure: 'Tap-to-expose on the Moon, drag exposure down 1–2 stops to avoid blowout',
        focus: "Tap to focus on the Moon's edge, not the sky around it",
      },
      nothing: {
        mode: 'Standard photo or Night mode off if the Moon is blowing out',
        lens: '3a: 2x telephoto; 3a Pro: 3x periscope for the Moon, otherwise main camera',
        tripod: 'recommended',
        exposure: 'Tap the Moon and drag exposure down until surface detail appears; avoid long Night mode glow',
        focus: 'Tap-to-focus directly on the lunar disc, then do not recompose too aggressively',
      },
      other: {
        mode: 'Standard photo, avoid zooming past 2x digital',
        lens: 'Main',
        tripod: 'recommended',
        exposure: 'Tap the Moon directly and drag exposure down if the app allows it',
        focus: 'Tap to focus on the Moon',
      },
    },
  },
  bright_planet: {
    title: 'Bright planet',
    compositionTip: 'Shoot low over a horizon or skyline for scale — a lone point of light needs an anchor.',
    expectedResult: 'A sharp, bright point of light with a small halo; nice as a wide shot against dusk or dawn colour.',
    devices: {
      apple: {
        mode: 'Night mode, phone locked down',
        lens: 'Main (1x) for context, telephoto for a tight shot',
        tripod: 'required',
        exposure: "Let Night mode run its multi-second capture; don't touch the phone mid-shot",
        focus: 'Tap on the planet and wait for focus lock before shooting',
      },
      nothing: {
        mode: 'Night mode',
        lens: 'Main for sky context; telephoto only for a very bright planet over a steady tripod',
        tripod: 'required',
        exposure: 'Let Night mode stack the scene; reduce exposure if the planet blooms into a blob',
        focus: 'Tap to focus on the brightest point, or a distant light at the same horizon distance',
      },
      other: {
        mode: 'Night mode if available, else standard',
        lens: 'Main',
        tripod: 'required',
        exposure: 'Brace against a wall or rail if you have no tripod',
        focus: 'Tap to focus on the point of light',
      },
    },
  },
  iss_pass: {
    title: 'ISS pass',
    compositionTip: 'Frame a wide stretch of sky in the direction of travel so the trail has room to run; include a horizon line for context.',
    expectedResult: "A bright, continuous streak across the frame — steady and non-blinking, unlike an aircraft.",
    devices: {
      apple: {
        mode: 'Night mode at max duration, or a manual app for a 10–20s exposure',
        lens: 'Main (widest field of view)',
        tripod: 'required',
        exposure: '10–20 second exposure if manual control is available, otherwise a full-duration Night mode capture',
        focus: 'Manual focus to infinity if available, else tap a distant light or star',
      },
      nothing: {
        mode: 'Night mode, longest duration available',
        lens: 'Main camera only; do not use telephoto for a moving ISS pass',
        tripod: 'required',
        exposure: 'Start the capture 5–10 seconds before the pass enters your frame and let it finish untouched',
        focus: 'Focus on a distant star before the pass starts, then leave it locked',
      },
      other: {
        mode: 'Night mode if available',
        lens: 'Main',
        tripod: 'required',
        exposure: 'Use the longest exposure the camera app allows',
        focus: 'Focus on a distant object before the pass begins and leave it locked',
      },
    },
  },
  meteor_shower: {
    title: 'Meteor shower',
    compositionTip: "Point away from the radiant's exact point — meteors read longer and more dramatic off to the side — and include a horizon.",
    expectedResult: 'Realistically: a nice starfield most of the time, with an occasional bright streak if you have patience.',
    devices: {
      apple: {
        mode: 'Night mode at max duration, or a manual app for repeated 15–30s frames',
        lens: 'Main, or ultra-wide for more sky coverage',
        tripod: 'required',
        exposure: '15–30s per frame, shot as a continuous burst over 20–30 minutes',
        focus: 'Manual focus to infinity',
      },
      nothing: {
        mode: 'Night mode, repeated captures back-to-back',
        lens: 'Main',
        tripod: 'required',
        exposure: 'Use repeated longest-duration Night mode shots; expect many empty frames before one meteor',
        focus: 'Focus on a bright star or distant light, then avoid touching focus again',
      },
      other: {
        mode: 'Night mode if available',
        lens: 'Main',
        tripod: 'required',
        exposure: 'Longest available exposure, taken repeatedly',
        focus: 'Focus on the brightest visible star',
      },
    },
  },
  conjunction: {
    title: 'Conjunction',
    compositionTip: 'Frame both objects with some breathing room and a foreground element — a great low-horizon wide shot.',
    expectedResult: 'Two bright points close together against a twilight or dark sky, sharp and clearly separated.',
    devices: {
      apple: {
        mode: 'Night mode',
        lens: 'Main (1x) to keep both objects in frame',
        tripod: 'recommended',
        exposure: 'Tap-to-expose roughly between the two objects',
        focus: 'Tap to focus roughly between the pair',
      },
      nothing: {
        mode: 'Night mode',
        lens: 'Main',
        tripod: 'recommended',
        exposure: 'Automatic Night mode exposure; lower brightness if either object blooms',
        focus: 'Tap between the two objects',
      },
      other: {
        mode: 'Standard, or Night mode if available',
        lens: 'Main',
        tripod: 'recommended',
        exposure: 'Default automatic exposure',
        focus: 'Tap between the two objects',
      },
    },
  },
  eclipse: {
    title: 'Eclipse',
    compositionTip:
      'For a lunar eclipse, treat it like a Moon shot but re-expose as it darkens. For a solar eclipse, never shoot without a proper solar filter over the lens.',
    expectedResult: 'A darkened, reddish Moon (lunar), or a crescent/corona (solar — filtered only).',
    devices: {
      apple: {
        mode: 'A manual app to track brightness changes through totality',
        lens: 'Telephoto (5x+ digital)',
        tripod: 'required',
        exposure: 'Increase exposure progressively as totality approaches, then reduce it again after',
        focus: "Manual focus locked on the Moon early, before it dims too much to autofocus",
      },
      nothing: {
        mode: 'Night mode, adjusted manually as it darkens if the app allows it',
        lens: '3a: 2x telephoto; 3a Pro: 3x periscope for lunar eclipse. Solar eclipse requires a proper solar filter.',
        tripod: 'required',
        exposure: 'Re-expose every few minutes as brightness changes',
        focus: 'Focus early while the Moon is still bright, then lock',
      },
      other: {
        mode: 'Standard, with brightness/ISO boosted manually if available',
        lens: 'Main',
        tripod: 'required',
        exposure: 'Expect a dim, noisy shot',
        focus: 'Focus early, before it darkens too much to autofocus',
      },
    },
  },
  twilight: {
    title: 'Twilight sky / skyline',
    compositionTip: 'Classic rule-of-thirds horizon shot — skyline or landscape in the bottom third, sky filling the rest.',
    expectedResult: 'A vivid gradient sky (orange through deep blue) with a silhouetted foreground.',
    devices: {
      apple: {
        mode: 'Standard photo mode, HDR on',
        lens: 'Main or ultra-wide for a dramatic sky',
        tripod: 'optional',
        exposure: 'Tap-to-expose on the sky, not the ground, to keep colour saturation',
        focus: 'Tap on the horizon line',
      },
      nothing: {
        mode: 'Standard photo mode',
        lens: 'Main',
        tripod: 'optional',
        exposure: 'Tap-to-expose on the brightest part of the sky',
        focus: 'Tap on the horizon',
      },
      other: {
        mode: 'Standard photo mode',
        lens: 'Main',
        tripod: 'optional',
        exposure: 'Default auto-exposure; tap the sky so the foreground does not blow it out',
        focus: 'Tap on the horizon',
      },
    },
  },
  milky_way: {
    title: 'Dark-sky Milky Way attempt',
    compositionTip: 'Needs genuinely dark skies — a silhouetted foreground anchors what would otherwise be an abstract wide shot.',
    expectedResult: 'Realistically, a faint hazy band at best on a phone. Manage expectations versus a dedicated camera.',
    devices: {
      apple: {
        mode: 'Night mode at max duration (up to 30s), or a manual app at ISO 3200–6400, f/1.78, 10–20s',
        lens: 'Ultra-wide (widest field of view, largest aperture)',
        tripod: 'required',
        exposure: 'As long an exposure as possible without star trailing — around 15–20s at this focal length',
        focus: 'Manual focus to infinity, verified by zooming into a preview star',
      },
      nothing: {
        mode: 'Night mode at max duration',
        lens: 'Main camera; ultrawide is too noisy unless the sky is genuinely dark',
        tripod: 'required',
        exposure: 'Longest Night mode duration available; take several frames and keep only the cleanest',
        focus: 'Focus on a distant light source, then lock to infinity if possible',
      },
      other: {
        mode: 'Night mode if available — otherwise this is a stretch target',
        lens: 'Main',
        tripod: 'required',
        exposure: 'Longest available exposure; expect noise',
        focus: 'Manual/infinity focus if the camera app supports it',
      },
    },
  },
}

// Maps a SkyEvent/TonightTarget kind to the recipe that applies to it.
// deep_sky targets get the Milky Way recipe since that's the realistic
// phone-photography angle on a faint deep-sky object, not per-object detail.
const RECIPE_KEY_FOR_EVENT_KIND: Record<string, RecipeKey> = {
  moon_phase: 'moon',
  planet_event: 'bright_planet',
  iss_pass: 'iss_pass',
  meteor_shower: 'meteor_shower',
  conjunction: 'conjunction',
  eclipse: 'eclipse',
  deep_sky: 'milky_way',
}

export function recipeKeyForEventKind(kind: string): RecipeKey | null {
  return RECIPE_KEY_FOR_EVENT_KIND[kind] ?? null
}

export function deviceRecipeFor(recipeKey: RecipeKey, device: DeviceId): DeviceRecipe {
  const family = CAMERA_PROFILES[device].recipeFamily
  return CAMERA_RECIPES[recipeKey].devices[family] ?? CAMERA_RECIPES[recipeKey].devices.other
}

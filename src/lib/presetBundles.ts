import { CAMERA_PROFILES, EXPORT_CAPABILITY_BY_MAKER, type DeviceId, type PresetExportCapability } from './cameraProfiles'
import { CAMERA_RECIPES, deviceRecipeFor, type RecipeKey } from './cameraRecipes'
import { CAMERA_PRESET_SCHEMA_VERSION, type CameraPresetSettings } from './db'
import { generateCubeLut } from './presetExport/cube'
import { generateXmpPreset } from './presetExport/xmp'
import { RECIPE_LOOK_PRESETS } from './presetExport/lookPresets'

export interface AtlasPresetBundle {
  format: 'atlas-camera-preset-bundle'
  version: 1
  targetKey: RecipeKey
  targetTitle: string
  device: {
    id: DeviceId
    maker: string
    model: string
  }
  settings: CameraPresetSettings
  install: PresetExportCapability
  createdAt: string
}

// Per-maker capability (method/notes/steps) lives in cameraProfiles.ts
// (KES-299) so adding a maker's export path means adding one table row
// there, not another branch here.
function installInfo(device: DeviceId): AtlasPresetBundle['install'] {
  return EXPORT_CAPABILITY_BY_MAKER[CAMERA_PROFILES[device].maker]
}

export function createPresetBundle(recipeKey: RecipeKey, device: DeviceId): AtlasPresetBundle {
  const profile = CAMERA_PROFILES[device]
  const recipe = CAMERA_RECIPES[recipeKey]
  const deviceRecipe = deviceRecipeFor(recipeKey, device)
  return {
    format: 'atlas-camera-preset-bundle',
    version: 1,
    targetKey: recipeKey,
    targetTitle: recipe.title,
    device: {
      id: device,
      maker: profile.maker,
      model: profile.name,
    },
    settings: {
      schemaVersion: CAMERA_PRESET_SCHEMA_VERSION,
      capture: {
        mode: deviceRecipe.mode,
        lens: deviceRecipe.lens,
      },
      look: RECIPE_LOOK_PRESETS[recipeKey],
    },
    install: installInfo(device),
    createdAt: new Date().toISOString(),
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// On mobile, a plain download drops the preset in the Downloads folder --
// one more manual step before it reaches Nothing Camera/Lightroom Mobile.
// Web Share hands the file straight to the "Open in..." / "Share to..."
// sheet instead, so the OS can offer the right app directly. Desktop
// browsers, and older/unsupported mobile ones, don't support sharing files
// (or `canShare` says no for this file), so this always has the download as
// a fallback.
async function shareOrDownload(blob: Blob, filename: string, mimeType: string) {
  const file = new File([blob], filename, { type: mimeType })
  const canShareFile = typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  if (canShareFile) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return // user dismissed the share sheet
      // Any other share failure (e.g. no compatible target app) falls through to a plain download.
    }
  }

  triggerDownload(blob, filename)
}

export async function downloadPresetBundle(recipeKey: RecipeKey, device: DeviceId) {
  const bundle = createPresetBundle(recipeKey, device)

  if (bundle.install.method === 'cube-lut' && bundle.settings.look) {
    const cube = generateCubeLut(bundle.settings.look, { title: `Atlas ${bundle.targetTitle}` })
    await shareOrDownload(new Blob([cube], { type: 'text/plain' }), `atlas-${recipeKey}-${device}.cube`, 'text/plain')
    return
  }

  if (bundle.install.method === 'xmp-preset' && bundle.settings.look) {
    const xmp = generateXmpPreset(bundle.settings.look, { name: `Atlas ${bundle.targetTitle}` })
    await shareOrDownload(new Blob([xmp], { type: 'application/rdf+xml' }), `atlas-${recipeKey}-${device}.xmp`, 'application/rdf+xml')
    return
  }

  await shareOrDownload(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }), `atlas-${recipeKey}-${device}.atlas-preset.json`, 'application/json')
}

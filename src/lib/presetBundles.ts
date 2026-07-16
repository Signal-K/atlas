import { CAMERA_PROFILES, type DeviceId } from './cameraProfiles'
import { CAMERA_RECIPES, deviceRecipeFor, type RecipeKey } from './cameraRecipes'
import type { CameraPresetSettings } from './db'

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
  install: {
    nativeInstall: boolean
    method: 'atlas-json' | 'manual-copy' | 'shortcut-or-manual'
    notes: string
    steps: string[]
  }
  createdAt: string
}

function installInfo(device: DeviceId): AtlasPresetBundle['install'] {
  const profile = CAMERA_PROFILES[device]
  if (profile.maker === 'nothing') {
    return {
      nativeInstall: false,
      method: 'manual-copy',
      notes: 'Nothing exposes camera looks/presets in its camera experience, but a stable public user-preset file install format is not documented. This bundle is installable in Atlas and copyable into Camera setup.',
      steps: [
        'Download the Atlas preset bundle.',
        'Open Atlas on the phone before the event.',
        'Follow the mode, lens, exposure, and focus steps shown in the event configuration.',
        'If Nothing later exposes a preset import format, this bundle can be mapped by the PocketBase extension.',
      ],
    }
  }
  if (profile.maker === 'samsung') {
    return {
      nativeInstall: false,
      method: 'manual-copy',
      notes: 'Samsung settings should be copied into Camera Pro mode or Expert RAW where available.',
      steps: ['Download the bundle.', 'Open Camera Pro mode or Expert RAW.', 'Copy ISO/exposure/focus guidance from Atlas.'],
    }
  }
  if (profile.maker === 'apple') {
    return {
      nativeInstall: false,
      method: 'shortcut-or-manual',
      notes: 'iPhone camera styles/settings are not installable as a generic web preset file. Use this as an Atlas bundle plus setup checklist.',
      steps: ['Download the bundle.', 'Open Atlas or a Shortcut built around the bundle.', 'Copy the setup values before shooting.'],
    }
  }
  return {
    nativeInstall: false,
    method: 'manual-copy',
    notes: 'Use this as an Atlas preset bundle and copy the values into the best camera controls available on the device.',
    steps: ['Download the bundle.', 'Open your camera app.', 'Copy the setup values.'],
  }
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
      mode: deviceRecipe.mode,
      lens: deviceRecipe.lens,
    },
    install: installInfo(device),
    createdAt: new Date().toISOString(),
  }
}

export function downloadPresetBundle(recipeKey: RecipeKey, device: DeviceId) {
  const bundle = createPresetBundle(recipeKey, device)
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `atlas-${recipeKey}-${device}.atlas-preset.json`
  a.click()
  URL.revokeObjectURL(url)
}

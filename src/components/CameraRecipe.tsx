import { useEffect, useState } from 'react'
import { CAMERA_PROFILES, getDefaultDevice, setDefaultDevice, type DeviceId } from '../lib/cameraProfiles'
import { CAMERA_RECIPES, type RecipeKey } from '../lib/cameraRecipes'
import { trackEvent } from '../lib/analytics'
import { importPresetFile, PresetImportError, recommendPresetsForTarget } from '../lib/cameraPresets'
import type { CameraPreset } from '../lib/db'
import { useAuth } from '../lib/auth'
import { gearAffiliateUrl } from '../lib/affiliate'

const TRIPOD_LABEL: Record<string, string> = {
  required: 'Tripod required',
  recommended: 'Tripod recommended',
  optional: 'Tripod optional',
}

const DEVICE_ORDER: DeviceId[] = ['iphone-16-pro', 'nothing-phone-3a', 'generic']
const LOCAL_USER_ID = 'local'

export function CameraRecipe({ recipeKey }: { recipeKey: RecipeKey }) {
  const { user } = useAuth()
  const scopeId = user?.id ?? LOCAL_USER_ID
  const [device, setDevice] = useState<DeviceId>(() => getDefaultDevice())
  const [presets, setPresets] = useState<CameraPreset[]>([])
  const [importError, setImportError] = useState<string | null>(null)

  useEffect(() => {
    trackEvent('Opened camera recipe', { recipeKey })
  }, [recipeKey])

  useEffect(() => {
    let cancelled = false
    recommendPresetsForTarget(scopeId, recipeKey, device).then((result) => {
      if (!cancelled) setPresets(result)
    })
    return () => {
      cancelled = true
    }
  }, [scopeId, recipeKey, device])

  async function handleImportFile(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return
    setImportError(null)
    try {
      const text = await file.text()
      await importPresetFile(text, scopeId, device, file.name.replace(/\.[^.]+$/, ''), recipeKey)
      setPresets(await recommendPresetsForTarget(scopeId, recipeKey, device))
      trackEvent('Imported camera preset', { recipeKey, device })
    } catch (error) {
      setImportError(error instanceof PresetImportError ? error.message : 'Could not import this file.')
    }
  }

  function selectDevice(id: DeviceId) {
    setDevice(id)
    setDefaultDevice(id)
    trackEvent('Changed device profile', { device: id })
  }

  const recipe = CAMERA_RECIPES[recipeKey]
  const deviceRecipe = recipe.devices[device]
  const tripodShopUrl = gearAffiliateUrl('phone tripod astrophotography')

  return (
    <div className="camera-recipe">
      <div className="filter-tabs">
        {DEVICE_ORDER.map((id) => (
          <button key={id} type="button" className={device === id ? 'is-active' : ''} onClick={() => selectDevice(id)}>
            {CAMERA_PROFILES[id].name}
          </button>
        ))}
      </div>

      <dl className="camera-recipe-facts">
        <div>
          <dt>Mode</dt>
          <dd>{deviceRecipe.mode}</dd>
        </div>
        <div>
          <dt>Lens</dt>
          <dd>{deviceRecipe.lens}</dd>
        </div>
        <div>
          <dt>{TRIPOD_LABEL[deviceRecipe.tripod]}</dt>
          {deviceRecipe.tripod !== 'optional' && tripodShopUrl && (
            <dd>
              <a href={tripodShopUrl} target="_blank" rel="noopener noreferrer sponsored" className="camera-recipe-shop-link">
                Shop tripods
              </a>
            </dd>
          )}
        </div>
        <div>
          <dt>Exposure</dt>
          <dd>{deviceRecipe.exposure}</dd>
        </div>
        <div>
          <dt>Focus</dt>
          <dd>{deviceRecipe.focus}</dd>
        </div>
      </dl>

      <p className="camera-recipe-tip">{recipe.compositionTip}</p>
      <p className="camera-recipe-expected">Expect: {recipe.expectedResult}</p>

      <div className="camera-recipe-presets">
        <h4>Recommended presets for this device</h4>
        <ul className="camera-recipe-preset-list">
          {presets.map((preset) => (
            <li key={preset.id} className={preset.source === 'builtin' ? 'is-builtin' : 'is-custom'}>
              <span className="camera-recipe-preset-name">{preset.name}</span>
              <span className="camera-recipe-preset-source">{preset.source}</span>
              {preset.settings.mode && <span className="camera-recipe-preset-detail">Mode: {preset.settings.mode}</span>}
              {preset.settings.iso && <span className="camera-recipe-preset-detail">ISO {preset.settings.iso}</span>}
              {preset.settings.exposureSec && <span className="camera-recipe-preset-detail">{preset.settings.exposureSec}s</span>}
            </li>
          ))}
        </ul>

        <label className="camera-recipe-import">
          Import a preset file
          <input type="file" accept="application/json,.json" onChange={(e) => handleImportFile(e.target.files)} />
        </label>
        {importError && <p className="camera-recipe-import-error">{importError}</p>}
      </div>
    </div>
  )
}

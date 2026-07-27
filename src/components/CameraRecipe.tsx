import { useEffect, useState } from 'react'
import {
  CAMERA_PROFILES,
  MAKER_LABELS,
  MAKER_ORDER,
  getDefaultDevice,
  makerForDevice,
  modelsForMaker,
  setDefaultDevice,
  type DeviceId,
  type DeviceMaker,
} from '../lib/cameraProfiles'
import { CAMERA_RECIPES, deviceRecipeFor, describeLiveConditions, type LiveRecipeConditions, type RecipeKey } from '../lib/cameraRecipes'
import { trackEvent } from '../lib/analytics'
import { importPresetFile, PresetImportError, recommendPresetsForTarget } from '../lib/cameraPresets'
import type { CameraPreset } from '../lib/db'
import { useAuth } from '../lib/auth'
import { gearAffiliateUrl } from '../lib/affiliate'
import { createPresetBundle, downloadPresetBundle } from '../lib/presetBundles'
import { PaywallGate } from './PaywallGate'

const TRIPOD_LABEL: Record<string, string> = {
  required: 'Tripod required',
  recommended: 'Tripod recommended',
  optional: 'Tripod optional',
}

const LOCAL_USER_ID = 'local'

const SETUP_STEPS: Record<DeviceMaker, string[]> = {
  apple: [
    'Open Camera and choose the lens listed below before the target rises.',
    'iOS does not install generic web preset files into Camera, so use the downloaded Atlas bundle as a setup card.',
    'Lock the phone on a tripod, start the capture early, and avoid touching the screen during exposure.',
  ],
  google: [
    'Open Pixel Camera and choose Night Sight for dark sky work.',
    'Put the phone on a tripod or stable support so Astrophotography can engage when available.',
    'Use the downloaded Atlas bundle as the setup card; Pixel Camera does not install third-party web preset files.',
  ],
  nothing: [
    'Open Nothing Camera before the event and select the lens below. Use the main camera for dark sky, ISS, meteors, and Milky Way attempts.',
    'For Moon or bright planets, use the telephoto lens if your model has one, then reduce exposure until highlights stop blooming.',
    'Download the Atlas preset bundle now; native Nothing Camera installation needs a confirmed import format or backend mapper.',
  ],
  samsung: [
    'Open Camera Pro mode or Expert RAW if available.',
    'Copy the exposure/focus guidance below into Pro controls.',
    'Save the setup in Samsung where the app allows it; Atlas also downloads the bundle for reuse.',
  ],
  other: [
    'Open your camera app, enable Night mode if available, and select the main lens.',
    'If your camera has manual controls, copy the exposure and focus guidance below.',
    'Brace the phone or use a tripod; stability matters more than zoom.',
  ],
}

export function CameraRecipe({ recipeKey, liveConditions }: { recipeKey: RecipeKey; liveConditions?: LiveRecipeConditions }) {
  const { user } = useAuth()
  const scopeId = user?.id ?? LOCAL_USER_ID
  const initialDevice = getDefaultDevice()
  const [device, setDevice] = useState<DeviceId>(initialDevice)
  const [maker, setMaker] = useState<DeviceMaker>(() => makerForDevice(initialDevice))
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
    setMaker(makerForDevice(id))
    setDefaultDevice(id)
    trackEvent('Changed device profile', { device: id })
  }

  function selectMaker(next: DeviceMaker) {
    setMaker(next)
    selectDevice(modelsForMaker(next)[0].id)
  }

  const recipe = CAMERA_RECIPES[recipeKey]
  const deviceRecipe = deviceRecipeFor(recipeKey, device)
  const profile = CAMERA_PROFILES[device]
  const bundle = createPresetBundle(recipeKey, device)
  const tripodShopUrl = gearAffiliateUrl('phone tripod astrophotography')
  const liveTip = liveConditions ? describeLiveConditions(recipeKey, liveConditions) : null

  return (
    <PaywallGate
      user={user}
      feature="Deep camera setup"
      description="Downloadable preset bundles, device-specific setup steps, and deeper camera recommendations are part of the Sky Pass."
      freeNote="Your first walkthrough still includes the essential camera settings for free."
      onSignInClick={() => {
        window.location.href = '/settings'
      }}
    >
      <div className="camera-recipe">
        {liveTip && <p className="camera-recipe-live-tip">Tonight: {liveTip}</p>}
        <div className="camera-device-flow">
          <span className="camera-flow-label">1. Phone maker</span>
          <div className="filter-tabs camera-maker-tabs">
            {MAKER_ORDER.map((id) => (
              <button key={id} type="button" className={maker === id ? 'is-active' : ''} onClick={() => selectMaker(id)}>
                {MAKER_LABELS[id]}
              </button>
            ))}
          </div>

          <label className="camera-model-select">
            <span className="camera-flow-label">2. Model</span>
            <select value={device} onChange={(event) => selectDevice(event.target.value as DeviceId)}>
              {modelsForMaker(maker).map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="camera-preset-download">
          <div>
            <span className="camera-flow-label">3. Preset bundle</span>
            <p>{bundle.install.notes}</p>
          </div>
          <button type="button" onClick={() => downloadPresetBundle(recipeKey, device)}>
            Download Atlas preset
          </button>
        </div>

        <div className="camera-mode-summary">
          {profile.supportedModes.slice(0, 3).map((mode) => (
            <span key={mode}>{mode}</span>
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

        <div className="camera-recipe-setup">
          <h4>Set up {profile.name}</h4>
          <ol>
            {SETUP_STEPS[maker].map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <p className="camera-recipe-tip">{recipe.compositionTip}</p>
        <p className="camera-recipe-expected">Expect: {recipe.expectedResult}</p>

        <div className="camera-recipe-presets">
          <h4>Recommended presets for this model</h4>
          <ul className="camera-recipe-preset-list">
            {presets.slice(0, 4).map((preset) => (
              <li key={preset.id} className={preset.source === 'builtin' ? 'is-builtin' : 'is-custom'}>
                <span className="camera-recipe-preset-name">{preset.name}</span>
                <span className="camera-recipe-preset-source">{preset.source}</span>
                {preset.settings.mode && <span className="camera-recipe-preset-detail">Mode: {preset.settings.mode}</span>}
                {preset.settings.iso && <span className="camera-recipe-preset-detail">ISO {preset.settings.iso}</span>}
                {preset.settings.exposureSec && <span className="camera-recipe-preset-detail">{preset.settings.exposureSec}s</span>}
              </li>
            ))}
          </ul>

          {maker !== 'nothing' ? (
            <>
              <label className="camera-recipe-import">
                Import an Atlas preset file
                <input type="file" accept="application/json,.json,.atlas-preset" onChange={(e) => handleImportFile(e.target.files)} />
              </label>
              {importError && <p className="camera-recipe-import-error">{importError}</p>}
            </>
          ) : (
            <p className="camera-recipe-import-error">
              Nothing preset bundles download from Atlas now. Native Nothing Camera install requires a confirmed import format or a PocketBase mapper.
            </p>
          )}
        </div>
      </div>
    </PaywallGate>
  )
}

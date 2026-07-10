import { useEffect, useState } from 'react'
import { CAMERA_PROFILES, getDefaultDevice, setDefaultDevice, type DeviceId } from '../lib/cameraProfiles'
import { CAMERA_RECIPES, type RecipeKey } from '../lib/cameraRecipes'
import { trackEvent } from '../lib/analytics'

const TRIPOD_LABEL: Record<string, string> = {
  required: 'Tripod required',
  recommended: 'Tripod recommended',
  optional: 'Tripod optional',
}

const DEVICE_ORDER: DeviceId[] = ['iphone-16-pro', 'nothing-phone-3a', 'generic']

export function CameraRecipe({ recipeKey }: { recipeKey: RecipeKey }) {
  const [device, setDevice] = useState<DeviceId>(() => getDefaultDevice())

  useEffect(() => {
    trackEvent('Opened camera recipe', { recipeKey })
  }, [recipeKey])

  function selectDevice(id: DeviceId) {
    setDevice(id)
    setDefaultDevice(id)
    trackEvent('Changed device profile', { device: id })
  }

  const recipe = CAMERA_RECIPES[recipeKey]
  const deviceRecipe = recipe.devices[device]

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

      {device === 'nothing-phone-3a' && (
        <p className="camera-recipe-placeholder">Nothing camera preset import — coming later.</p>
      )}
    </div>
  )
}

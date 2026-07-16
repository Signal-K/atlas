import { useState } from 'react'
import { CAMERA_PROFILES, getDefaultDevice } from '../lib/cameraProfiles'
import { CAMERA_RECIPES, deviceRecipeFor, type RecipeKey } from '../lib/cameraRecipes'
import { trackEvent } from '../lib/analytics'

const STABILIZATION_TIP: Record<string, string> = {
  required: 'Tripod required — brace against a wall or railing if you don’t have one; a shake at this exposure ruins the shot.',
  recommended: 'Tripod recommended — resting the phone on something solid works if you don’t have one.',
  optional: 'Tripod optional — hold with both hands, elbows tucked in, and breathe out before tapping the shutter.',
}

// STS-318: a compact, glanceable summary of the same recipe CameraRecipe
// shows in full below — mode/zoom/exposure/focus/stabilization plus a
// one-tap copy, for someone who just wants to set up fast rather than work
// through the device picker and preset library.
export function CameraPresetCard({ recipeKey }: { recipeKey: RecipeKey }) {
  const [copied, setCopied] = useState(false)
  const device = getDefaultDevice()
  const recipe = CAMERA_RECIPES[recipeKey]
  const deviceRecipe = deviceRecipeFor(recipeKey, device)
  const profile = CAMERA_PROFILES[device]
  const stabilizationTip = STABILIZATION_TIP[deviceRecipe.tripod]

  async function copySettings() {
    const summary = [
      `${recipe.title} — ${profile.name}`,
      `Mode: ${deviceRecipe.mode}`,
      `Zoom/lens: ${deviceRecipe.lens}`,
      `Exposure: ${deviceRecipe.exposure}`,
      `Focus: ${deviceRecipe.focus}`,
      `Stabilization: ${stabilizationTip}`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(summary)
      setCopied(true)
      trackEvent('Copied camera preset', { recipeKey, device })
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be denied/unavailable — the card's text is
      // still readable, so this is a silent no-op rather than an error state.
    }
  }

  return (
    <div className="camera-preset-card">
      <div className="camera-preset-card-header">
        <span className="camera-preset-card-title">{profile.name}</span>
        <button type="button" className="camera-preset-card-copy" onClick={copySettings}>
          {copied ? 'Copied!' : 'Copy settings'}
        </button>
      </div>
      <dl className="camera-preset-card-facts">
        <div>
          <dt>Mode</dt>
          <dd>{deviceRecipe.mode}</dd>
        </div>
        <div>
          <dt>Zoom</dt>
          <dd>{deviceRecipe.lens}</dd>
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
      <p className="camera-preset-card-stabilization">{stabilizationTip}</p>
    </div>
  )
}

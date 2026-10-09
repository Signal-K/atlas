import { useState } from 'react'
import { updateDeviceModels } from '../lib/auth'
import { DEVICE_PRESETS, devicePresetFor } from '../lib/devicePresets'
import { trackEvent } from '../lib/analytics'
import { FormStatus } from './forms/FormStatus'

export interface DeviceSettingsProps {
  deviceModels: string[]
  entitled: boolean
}

export function DeviceSettings({ deviceModels, entitled }: DeviceSettingsProps) {
  const [selected, setSelected] = useState(deviceModels)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function toggleDevice(value: string) {
    const previous = selected
    const next = previous.includes(value) ? previous.filter((v) => v !== value) : [...previous, value]
    setSelected(next)
    setSaving(true)
    setError('')
    try {
      await updateDeviceModels(next)
    } catch (err) {
      setSelected(previous)
      setError('Could not save your device. Try again shortly.')
      trackEvent('device_settings_save_failed', { error: String(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-devices">
      <p className="settings-help">Select the phone(s) you shoot with to get setup steps for astrophotography.</p>

      <div className="settings-devices-grid">
        {DEVICE_PRESETS.map((preset) => (
          <label key={preset.value} className="settings-toggle-row">
            <input type="checkbox" checked={selected.includes(preset.value)} disabled={saving} onChange={() => toggleDevice(preset.value)} />
            <span>{preset.label}</span>
          </label>
        ))}
      </div>

      <FormStatus message={error} tone={error ? 'error' : 'neutral'} live="assertive" />

      {selected.length > 0 && !entitled && <p className="settings-help">Get the Sky Pass above to see camera setup instructions for your device(s).</p>}

      {selected.length > 0 &&
        entitled &&
        selected.map((value) => {
          const preset = devicePresetFor(value)
          if (!preset) return null
          return (
            <div key={value} className="settings-device-instructions">
              <h3 className="settings-device-instructions-title">{preset.label} setup</h3>
              <ul>
                {preset.instructions.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ul>
            </div>
          )
        })}
    </div>
  )
}

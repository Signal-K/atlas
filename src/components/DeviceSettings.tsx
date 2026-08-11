import { useState } from 'react'
import { Link } from 'react-router-dom'
import { updateDeviceModels } from '../lib/auth'
import { DEVICE_PRESETS, devicePresetFor } from '../lib/devicePresets'

export interface DeviceSettingsProps {
  deviceModels: string[]
  entitled: boolean
}

export function DeviceSettings({ deviceModels, entitled }: DeviceSettingsProps) {
  const [selected, setSelected] = useState(deviceModels)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function toggleDevice(value: string) {
    const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]
    setSelected(next)
    setSaving(true)
    setError('')
    try {
      await updateDeviceModels(next)
    } catch {
      setSelected(selected)
      setError('Could not save your device. Try again shortly.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="ui-section">
      <h2 className="ui-section-title">Device & camera setup</h2>
      <p className="settings-help">Select the phone(s) you shoot with to get setup steps for astrophotography.</p>

      <div className="ui-device-grid">
        {DEVICE_PRESETS.map((preset) => (
          <label key={preset.value} className="settings-toggle-row">
            <input type="checkbox" checked={selected.includes(preset.value)} disabled={saving} onChange={() => toggleDevice(preset.value)} />
            <span>{preset.label}</span>
          </label>
        ))}
      </div>

      {error && <p className="account-form-error">{error}</p>}

      {selected.length > 0 && !entitled && (
        <p className="settings-help">
          <Link to="/app/account#sky-pass">Get the Sky Pass</Link> to see camera setup instructions for your device(s).
        </p>
      )}

      {selected.length > 0 &&
        entitled &&
        selected.map((value) => {
          const preset = devicePresetFor(value)
          if (!preset) return null
          return (
            <div key={value} className="ui-calendar-stat-row ui-event-detail-row">
              <span className="ui-section-title">{preset.label} setup</span>
              <ul className="ui-device-instructions">
                {preset.instructions.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ul>
            </div>
          )
        })}
    </section>
  )
}

import { useEffect, useState } from 'react'
import { getTonightPlan, type TonightPlan } from '../lib/tonightTargets'
import { enrichTargetsWithFraming, fieldOfViewDeg, type FramedTarget } from '../lib/framing'
import {
  CAMERA_PROFILES,
  MAKER_LABELS,
  MAKER_ORDER,
  effectiveGearProfile,
  getCustomLensFocalLengthMm,
  getDefaultDevice,
  makerForDevice,
  modelsForMaker,
  setCustomLensFocalLengthMm,
  setDefaultDevice,
  type DeviceId,
  type DeviceMaker,
} from '../lib/cameraProfiles'
import { addGetReadyReminder, ensureNotificationPermission } from '../lib/getReadyReminders'
import { trackEvent } from '../lib/analytics'

const MATCH_LABEL: Record<FramedTarget['framingMatch'], string> = {
  good: 'Frameable',
  'too-small': 'Speck',
  'too-large': 'Too wide',
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

// STS-177: equipment-aware target suggestions. Reuses getTonightPlan (the
// existing tonight's-targets visibility logic) as the base list and enriches
// it with a framing-match verdict per the user's selected device/lens --
// it does not recompute visibility itself.
export function DeepSkyPlannerView({ lat, lon }: { lat: number; lon: number }) {
  const initialDevice = getDefaultDevice()
  const [device, setDevice] = useState<DeviceId>(initialDevice)
  const [maker, setMaker] = useState<DeviceMaker>(() => makerForDevice(initialDevice))
  const [customFocalLengthMm, setCustomFocalLength] = useState<number | null>(() => getCustomLensFocalLengthMm())
  const [plan, setPlan] = useState<TonightPlan | null>(null)
  const [reminderMessage, setReminderMessage] = useState('')

  useEffect(() => {
    getTonightPlan(lat, lon).then(setPlan)
  }, [lat, lon])

  function selectDevice(id: DeviceId) {
    setDevice(id)
    setMaker(makerForDevice(id))
    setDefaultDevice(id)
    trackEvent('Changed deep-sky planner device', { device: id })
  }

  function selectMaker(next: DeviceMaker) {
    setMaker(next)
    selectDevice(modelsForMaker(next)[0].id)
  }

  function updateCustomFocalLength(raw: string) {
    const mm = raw.trim() === '' ? null : Number(raw)
    const value = mm != null && Number.isFinite(mm) && mm > 0 ? mm : null
    setCustomFocalLength(value)
    setCustomLensFocalLengthMm(value)
  }

  async function addReminder(target: FramedTarget) {
    const hasPermission = await ensureNotificationPermission()
    await addGetReadyReminder({
      eventId: target.eventId,
      title: target.title,
      startsAt: target.bestTime,
      deviceName: CAMERA_PROFILES[device].name,
    })
    setReminderMessage(
      hasPermission
        ? `Get-ready reminder added for ${target.title}.`
        : `Added to Hub. Browser notifications are not enabled, so Atlas will show it in-app.`,
    )
    trackEvent('Added get ready reminder', { target: target.title, device })
  }

  const gear = effectiveGearProfile(device)
  const fovDeg = fieldOfViewDeg(gear)
  const framedTargets = plan ? enrichTargetsWithFraming(plan.targets, gear) : []
  const selectedProfile = CAMERA_PROFILES[device]

  return (
    <section className="widget-section planner-screen">
      <div className="planner-topbar">
        <div>
          <h2>Deep-sky target planner</h2>
          <p className="planner-hint">Tonight's target fit, scored against your lens.</p>
        </div>
        <div className="planner-fov-dial" aria-label={`Estimated field of view ${fovDeg.toFixed(1)} degrees`}>
          <span>{fovDeg.toFixed(1)}°</span>
          <small>FOV</small>
        </div>
      </div>

      <div className="planner-control-panel">
        <div className="filter-tabs camera-maker-tabs">
          {MAKER_ORDER.map((id) => (
            <button key={id} type="button" className={maker === id ? 'is-active' : ''} onClick={() => selectMaker(id)}>
              {MAKER_LABELS[id]}
            </button>
          ))}
        </div>

        <div className="planner-model-grid" role="radiogroup" aria-label="Camera model">
          {modelsForMaker(maker).map((profile) => (
            <button
              key={profile.id}
              type="button"
              className={device === profile.id ? 'is-active' : ''}
              onClick={() => selectDevice(profile.id)}
              role="radio"
              aria-checked={device === profile.id}
            >
              <span>{profile.name}</span>
              <small>{profile.gear.focalLengthMm}mm</small>
            </button>
          ))}
        </div>

        <div className="planner-gear-strip">
          <div>
            <span className="camera-flow-label">Device</span>
            <strong>{selectedProfile.name}</strong>
          </div>
          <div>
            <span className="camera-flow-label">Lens</span>
            <label className="planner-lens-input">
              <input
                type="number"
                min={1}
                placeholder={`${CAMERA_PROFILES[device].gear.focalLengthMm}`}
                value={customFocalLengthMm ?? ''}
                onChange={(event) => updateCustomFocalLength(event.target.value)}
                aria-label="Custom 35mm-equivalent lens focal length"
              />
              <span>mm</span>
            </label>
          </div>
          <div>
            <span className="camera-flow-label">Targets</span>
            <strong>{framedTargets.length || '...'}</strong>
          </div>
        </div>
      </div>
      {reminderMessage && <p className="planner-reminder-status">{reminderMessage}</p>}

      {!plan && <p>Loading tonight's targets…</p>}
      {plan && framedTargets.length === 0 && <p>No targets tonight to frame — check the Tonight tab.</p>}
      {framedTargets.length > 0 && (
        <ul className="row-list planner-target-list">
          {framedTargets.map((target) => (
            <li key={target.eventId} className="planner-target">
              <div className="planner-target-main">
                <div className="planner-target-copy">
                  <div className="planner-target-header">
                    <span className="row-text">{target.title}</span>
                    <span className={`planner-match planner-match--${target.framingMatch}`}>{MATCH_LABEL[target.framingMatch]}</span>
                  </div>
                  <p className="row-meta">
                    {formatTime(target.bestTime)} · {target.angularSizeDeg}° target
                  </p>
                </div>
                <div className="planner-frame-meter" aria-label={`${target.title} fills ${Math.round((target.angularSizeDeg / fovDeg) * 100)} percent of the frame`}>
                  <span style={{ width: `${Math.min(100, Math.max(4, (target.angularSizeDeg / fovDeg) * 100))}%` }} />
                </div>
              </div>
              <button type="button" className="planner-reminder-button" onClick={() => addReminder(target)}>
                Notify
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

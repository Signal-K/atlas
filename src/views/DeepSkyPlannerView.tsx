import { useEffect, useState } from 'react'
import { getTonightPlan, type TonightPlan } from '../lib/tonightTargets'
import { enrichTargetsWithFraming, fieldOfViewDeg, type FramedTarget } from '../lib/framing'
import {
  CAMERA_PROFILES,
  effectiveGearProfile,
  getCustomLensFocalLengthMm,
  getDefaultDevice,
  setCustomLensFocalLengthMm,
  setDefaultDevice,
  type DeviceId,
} from '../lib/cameraProfiles'
import { trackEvent } from '../lib/analytics'

const DEVICE_ORDER: DeviceId[] = ['iphone-16-pro', 'nothing-phone-3a', 'generic']

const MATCH_LABEL: Record<FramedTarget['framingMatch'], string> = {
  good: 'Good framing match',
  'too-small': "Too small — will read as a speck at this focal length",
  'too-large': "Won't fit in frame at this focal length",
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

// STS-177: equipment-aware target suggestions. Reuses getTonightPlan (the
// existing tonight's-targets visibility logic) as the base list and enriches
// it with a framing-match verdict per the user's selected device/lens --
// it does not recompute visibility itself.
export function DeepSkyPlannerView({ lat, lon }: { lat: number; lon: number }) {
  const [device, setDevice] = useState<DeviceId>(() => getDefaultDevice())
  const [customFocalLengthMm, setCustomFocalLength] = useState<number | null>(() => getCustomLensFocalLengthMm())
  const [plan, setPlan] = useState<TonightPlan | null>(null)

  useEffect(() => {
    getTonightPlan(lat, lon).then(setPlan)
  }, [lat, lon])

  function selectDevice(id: DeviceId) {
    setDevice(id)
    setDefaultDevice(id)
    trackEvent('Changed deep-sky planner device', { device: id })
  }

  function updateCustomFocalLength(raw: string) {
    const mm = raw.trim() === '' ? null : Number(raw)
    const value = mm != null && Number.isFinite(mm) && mm > 0 ? mm : null
    setCustomFocalLength(value)
    setCustomLensFocalLengthMm(value)
  }

  const gear = effectiveGearProfile(device)
  const fovDeg = fieldOfViewDeg(gear)
  const framedTargets = plan ? enrichTargetsWithFraming(plan.targets, gear) : []

  return (
    <section className="widget-section">
      <h2>Deep-sky target planner</h2>
      <p className="planner-hint">Tonight's targets, ranked by how well they'll actually frame with your gear.</p>

      <div className="filter-tabs">
        {DEVICE_ORDER.map((id) => (
          <button key={id} type="button" className={device === id ? 'is-active' : ''} onClick={() => selectDevice(id)}>
            {CAMERA_PROFILES[id].name}
          </button>
        ))}
      </div>

      <label className="planner-custom-lens">
        Custom lens focal length (35mm-equivalent mm, optional)
        <input
          type="number"
          min={1}
          placeholder={`${CAMERA_PROFILES[device].gear.focalLengthMm}`}
          value={customFocalLengthMm ?? ''}
          onChange={(event) => updateCustomFocalLength(event.target.value)}
        />
      </label>

      <p className="planner-fov">Estimated field of view: {fovDeg.toFixed(1)}°</p>

      {!plan && <p>Loading tonight's targets…</p>}
      {plan && framedTargets.length === 0 && <p>No targets tonight to frame — check the Tonight tab.</p>}
      {framedTargets.length > 0 && (
        <ul className="row-list planner-target-list">
          {framedTargets.map((target) => (
            <li key={target.eventId} className="planner-target">
              <div className="planner-target-header">
                <span className="row-text">{target.title}</span>
                <span className={`planner-match planner-match--${target.framingMatch}`}>{MATCH_LABEL[target.framingMatch]}</span>
              </div>
              <p className="row-meta">
                {formatTime(target.bestTime)} · angular size ~{target.angularSizeDeg}°
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

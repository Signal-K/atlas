import { useState } from 'react'
import { angularSizeDegForTarget, fieldOfViewDeg, framingMatch, type FramingMatch } from '../../lib/framing'
import { effectiveGearProfile, getDefaultDevice } from '../../lib/cameraProfiles'
import { BackIcon, MobileIcon } from './MobileIcon'

const GEAR_TARGETS = [
  { id: 'moon', label: 'Moon', kind: 'moon_phase', title: 'Moon' },
  { id: 'orion', label: 'Orion Nebula', kind: 'deep_sky', title: 'Orion Nebula' },
  { id: 'andromeda', label: 'Andromeda', kind: 'deep_sky', title: 'Andromeda' },
  { id: 'pleiades', label: 'Pleiades', kind: 'deep_sky', title: 'Pleiades' },
]

const FOCAL_LENGTHS = [24, 50, 135, 200, 400, 600]
const SENSORS = [
  { id: 'full-frame', label: 'Full-frame', width: 36 },
  { id: 'aps-c', label: 'APS-C', width: 23.5 },
] as const

const MATCH_LABEL: Record<FramingMatch, string> = {
  good: 'Good framing — the target fills a comfortable part of the frame.',
  'too-small': 'Too small — this target will read as a tiny speck at this focal length.',
  'too-large': "Too large — this target won't fit in frame; try a shorter focal length.",
}

// Default-device summary for the Plan page's tool card, before the user has
// opened the panel and possibly changed focal length/sensor.
export function defaultGearFitSummary() {
  return { focalLength: effectiveGearProfile(getDefaultDevice()).focalLengthMm, sensorLabel: 'APS-C' }
}

export function GearFitPanel({ onBack }: { onBack: () => void }) {
  const [focalLength, setFocalLength] = useState(() => effectiveGearProfile(getDefaultDevice()).focalLengthMm)
  const [sensorId, setSensorId] = useState<'full-frame' | 'aps-c'>('aps-c')
  const [gearTargetId, setGearTargetId] = useState(GEAR_TARGETS[1].id)

  const sensor = SENSORS.find((s) => s.id === sensorId) ?? SENSORS[1]
  const gearTarget = GEAR_TARGETS.find((t) => t.id === gearTargetId) ?? GEAR_TARGETS[1]
  const fovDeg = fieldOfViewDeg({ focalLengthMm: focalLength, sensorWidthMm: sensor.width })
  const targetAngularSizeDeg = angularSizeDegForTarget(gearTarget)
  const match: FramingMatch = framingMatch(targetAngularSizeDeg, fovDeg)

  return (
    <div className="mobile-plan">
      <section className="mobile-card">
        <button type="button" className="mobile-back mobile-plan-detail-back" onClick={onBack} aria-label="Back to plan">
          <BackIcon />
        </button>
        <div className="mobile-card-eyebrow mobile-card-eyebrow--icon">
          <MobileIcon name="camera" /> Gear fit
        </div>
        <p className="mobile-empty-hint">
          {gearTarget.label} at {focalLength}mm &middot; {sensor.label} &middot; FOV {fovDeg >= 10 ? fovDeg.toFixed(0) : fovDeg.toFixed(1)}&deg;
        </p>
        <div className={`mobile-gear-fit-preview mobile-gear-fit-preview--${match}`}>
          <div
            className="mobile-gear-fit-dot"
            style={{ width: `${Math.round(Math.max(0.04, Math.min(1, targetAngularSizeDeg / fovDeg)) * 100)}%` }}
          />
        </div>
        <p className="mobile-empty-hint">{MATCH_LABEL[match]}</p>

        <span className="mobile-plan-day-stamp-label">Target</span>
        <div className="mobile-plan-type-row">
          {GEAR_TARGETS.map((target) => (
            <button type="button" key={target.id} className={target.id === gearTargetId ? 'is-active' : ''} onClick={() => setGearTargetId(target.id)}>
              {target.label}
            </button>
          ))}
        </div>

        <span className="mobile-plan-day-stamp-label">Focal length</span>
        <div className="mobile-plan-type-row">
          {FOCAL_LENGTHS.map((value) => (
            <button type="button" key={value} className={value === focalLength ? 'is-active' : ''} onClick={() => setFocalLength(value)}>
              {value}mm
            </button>
          ))}
        </div>

        <span className="mobile-plan-day-stamp-label">Sensor</span>
        <div className="mobile-plan-type-row">
          {SENSORS.map((s) => (
            <button type="button" key={s.id} className={s.id === sensorId ? 'is-active' : ''} onClick={() => setSensorId(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

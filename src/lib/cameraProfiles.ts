// Camera device profiles (AT epic 2, task 1). Scoped to the three devices
// the sprint brief names -- no attempt at a general device database.
export type DeviceId = 'iphone-16-pro' | 'nothing-phone-3a' | 'generic'

// STS-177 gear prerequisite: focal length is stored as its 35mm-equivalent
// (the industry-standard way phone cameras quote zoom reach), paired with
// the 35mm full-frame-equivalent sensor width -- that pairing is what makes
// the field-of-view formula in framing.ts correct without needing each
// device's true physical sensor size. `focalLengthMm` is the best lens for
// astro framing on that device (its telephoto, if it has one), not
// necessarily the default/main lens.
export interface GearProfile {
  focalLengthMm: number
  sensorWidthMm: number
}

export interface CameraProfile {
  id: DeviceId
  name: string
  supportedModes: string[]
  notes: string
  gear: GearProfile
}

const FULL_FRAME_EQUIVALENT_SENSOR_WIDTH_MM = 36

export const CAMERA_PROFILES: Record<DeviceId, CameraProfile> = {
  'iphone-16-pro': {
    id: 'iphone-16-pro',
    name: 'iPhone 16 Pro',
    supportedModes: ['Night mode', 'ProRAW', '5x telephoto', 'Manual exposure via third-party apps (e.g. Halide)'],
    notes: 'The strongest camera in this lineup — best telephoto reach and the most manual control when you need it.',
    gear: { focalLengthMm: 120, sensorWidthMm: FULL_FRAME_EQUIVALENT_SENSOR_WIDTH_MM },
  },
  'nothing-phone-3a': {
    id: 'nothing-phone-3a',
    name: 'Nothing Phone 3a',
    supportedModes: ['Night mode', '50MP main sensor', '2x optical-quality zoom'],
    notes: 'Solid night mode, but less manual control than the iPhone — lean on its automatic multi-frame capture rather than fighting it.',
    gear: { focalLengthMm: 48, sensorWidthMm: FULL_FRAME_EQUIVALENT_SENSOR_WIDTH_MM },
  },
  generic: {
    id: 'generic',
    name: 'Generic phone',
    supportedModes: ['Night mode (if available)', 'Digital zoom only'],
    notes: 'Assume no manual controls and no true optical zoom. Stability and framing matter more than settings here.',
    gear: { focalLengthMm: 26, sensorWidthMm: FULL_FRAME_EQUIVALENT_SENSOR_WIDTH_MM },
  },
}

const DEFAULT_DEVICE_KEY = 'atlas-default-camera-device'
const CUSTOM_FOCAL_LENGTH_KEY = 'atlas-custom-lens-focal-length-mm'

export function getDefaultDevice(): DeviceId {
  const stored = localStorage.getItem(DEFAULT_DEVICE_KEY)
  return stored != null && stored in CAMERA_PROFILES ? (stored as DeviceId) : 'generic'
}

export function setDefaultDevice(id: DeviceId) {
  localStorage.setItem(DEFAULT_DEVICE_KEY, id)
}

// Optional override for a real external/attachment lens (e.g. a clip-on
// telephoto), in 35mm-equivalent mm. Applies regardless of selected device.
export function getCustomLensFocalLengthMm(): number | null {
  const stored = localStorage.getItem(CUSTOM_FOCAL_LENGTH_KEY)
  const parsed = stored != null ? Number(stored) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function setCustomLensFocalLengthMm(mm: number | null) {
  if (mm == null) localStorage.removeItem(CUSTOM_FOCAL_LENGTH_KEY)
  else localStorage.setItem(CUSTOM_FOCAL_LENGTH_KEY, String(mm))
}

export function effectiveGearProfile(device: DeviceId): GearProfile {
  const base = CAMERA_PROFILES[device].gear
  const customFocalLengthMm = getCustomLensFocalLengthMm()
  return customFocalLengthMm != null ? { ...base, focalLengthMm: customFocalLengthMm } : base
}

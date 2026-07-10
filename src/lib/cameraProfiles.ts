// Camera device profiles (AT epic 2, task 1). Scoped to the three devices
// the sprint brief names -- no attempt at a general device database.
export type DeviceId = 'iphone-16-pro' | 'nothing-phone-3a' | 'generic'

export interface CameraProfile {
  id: DeviceId
  name: string
  supportedModes: string[]
  notes: string
}

export const CAMERA_PROFILES: Record<DeviceId, CameraProfile> = {
  'iphone-16-pro': {
    id: 'iphone-16-pro',
    name: 'iPhone 16 Pro',
    supportedModes: ['Night mode', 'ProRAW', '5x telephoto', 'Manual exposure via third-party apps (e.g. Halide)'],
    notes: 'The strongest camera in this lineup — best telephoto reach and the most manual control when you need it.',
  },
  'nothing-phone-3a': {
    id: 'nothing-phone-3a',
    name: 'Nothing Phone 3a',
    supportedModes: ['Night mode', '50MP main sensor', '2x optical-quality zoom'],
    notes: 'Solid night mode, but less manual control than the iPhone — lean on its automatic multi-frame capture rather than fighting it.',
  },
  generic: {
    id: 'generic',
    name: 'Generic phone',
    supportedModes: ['Night mode (if available)', 'Digital zoom only'],
    notes: 'Assume no manual controls and no true optical zoom. Stability and framing matter more than settings here.',
  },
}

const DEFAULT_DEVICE_KEY = 'atlas-default-camera-device'

export function getDefaultDevice(): DeviceId {
  const stored = localStorage.getItem(DEFAULT_DEVICE_KEY)
  return stored != null && stored in CAMERA_PROFILES ? (stored as DeviceId) : 'generic'
}

export function setDefaultDevice(id: DeviceId) {
  localStorage.setItem(DEFAULT_DEVICE_KEY, id)
}

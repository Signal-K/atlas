export type DeviceMaker = 'apple' | 'google' | 'nothing' | 'samsung' | 'other'
export type RecipeFamily = DeviceMaker

export type DeviceId =
  | 'iphone'
  | 'iphone-15'
  | 'iphone-16'
  | 'iphone-17'
  | 'iphone-17-pro'
  | 'iphone-16-pro'
  | 'iphone-15-pro'
  | 'pixel-10-pro'
  | 'pixel-9-pro'
  | 'pixel-8-pro'
  | 'nothing-phone-3'
  | 'nothing-phone-3a'
  | 'nothing-phone-2'
  | 'galaxy-s26-ultra'
  | 'galaxy-s25-ultra'
  | 'galaxy-s24-ultra'
  | 'other-phone'

export interface GearProfile {
  focalLengthMm: number
  sensorWidthMm: number
}

export interface CameraProfile {
  id: DeviceId
  maker: DeviceMaker
  recipeFamily: RecipeFamily
  name: string
  supportedModes: string[]
  notes: string
  gear: GearProfile
}

const FULL_FRAME_EQUIVALENT_SENSOR_WIDTH_MM = 36

export const MAKER_LABELS: Record<DeviceMaker, string> = {
  apple: 'Apple',
  google: 'Google',
  nothing: 'Nothing',
  samsung: 'Samsung',
  other: 'Other',
}

export const MAKER_ORDER: DeviceMaker[] = ['google', 'nothing', 'apple', 'samsung', 'other']

export const CAMERA_PROFILES: Record<DeviceId, CameraProfile> = {
  iphone: {
    id: 'iphone',
    maker: 'apple',
    recipeFamily: 'apple',
    name: 'Other iPhone',
    supportedModes: ['Night mode', 'standard camera'],
    notes: 'Use Night mode when available and brace the phone against something solid for the sharpest sky shots.',
    gear: { focalLengthMm: 26, sensorWidthMm: FULL_FRAME_EQUIVALENT_SENSOR_WIDTH_MM },
  },
  'iphone-15': {
    id: 'iphone-15',
    maker: 'apple',
    recipeFamily: 'apple',
    name: 'iPhone 15',
    supportedModes: ['Night mode', 'standard camera'],
    notes: 'Use Night mode and a stable support. The main camera is the dependable choice for sky scenes.',
    gear: { focalLengthMm: 26, sensorWidthMm: FULL_FRAME_EQUIVALENT_SENSOR_WIDTH_MM },
  },
  'iphone-16': {
    id: 'iphone-16',
    maker: 'apple',
    recipeFamily: 'apple',
    name: 'iPhone 16',
    supportedModes: ['Night mode', 'standard camera'],
    notes: 'Use Night mode and keep the phone still; a stable support matters more than zoom for sky shots.',
    gear: { focalLengthMm: 26, sensorWidthMm: FULL_FRAME_EQUIVALENT_SENSOR_WIDTH_MM },
  },
  'iphone-17': {
    id: 'iphone-17',
    maker: 'apple',
    recipeFamily: 'apple',
    name: 'iPhone 17',
    supportedModes: ['Night mode', 'standard camera'],
    notes: 'Use Night mode and a stable support. Start with the main camera rather than digital zoom.',
    gear: { focalLengthMm: 26, sensorWidthMm: FULL_FRAME_EQUIVALENT_SENSOR_WIDTH_MM },
  },
  'iphone-17-pro': {
    id: 'iphone-17-pro',
    maker: 'apple',
    recipeFamily: 'apple',
    name: 'iPhone 17 Pro',
    supportedModes: ['Night mode', 'Photographic Styles', 'ProRAW', 'telephoto'],
    notes: 'Strong automatic night capture. Use native Camera for most shots; use a manual app only when you need fixed focus/exposure.',
    gear: { focalLengthMm: 120, sensorWidthMm: FULL_FRAME_EQUIVALENT_SENSOR_WIDTH_MM },
  },
  'iphone-16-pro': {
    id: 'iphone-16-pro',
    maker: 'apple',
    recipeFamily: 'apple',
    name: 'iPhone 16 Pro',
    supportedModes: ['Night mode', 'Photographic Styles', 'ProRAW', '5x telephoto'],
    notes: 'Strong telephoto reach and flexible photographic styles, but native preset import is not exposed as a file install.',
    gear: { focalLengthMm: 120, sensorWidthMm: FULL_FRAME_EQUIVALENT_SENSOR_WIDTH_MM },
  },
  'iphone-15-pro': {
    id: 'iphone-15-pro',
    maker: 'apple',
    recipeFamily: 'apple',
    name: 'iPhone 15 Pro',
    supportedModes: ['Night mode', 'ProRAW', 'telephoto'],
    notes: 'Good low-light defaults. Keep setup simple and stable.',
    gear: { focalLengthMm: 77, sensorWidthMm: FULL_FRAME_EQUIVALENT_SENSOR_WIDTH_MM },
  },
  'pixel-10-pro': {
    id: 'pixel-10-pro',
    maker: 'google',
    recipeFamily: 'google',
    name: 'Pixel 10 Pro',
    supportedModes: ['Night Sight', 'Astrophotography', 'Pro controls'],
    notes: 'Pixel is the cleanest default path for sky shots: Night Sight plus a stable tripod unlocks astro behavior.',
    gear: { focalLengthMm: 120, sensorWidthMm: FULL_FRAME_EQUIVALENT_SENSOR_WIDTH_MM },
  },
  'pixel-9-pro': {
    id: 'pixel-9-pro',
    maker: 'google',
    recipeFamily: 'google',
    name: 'Pixel 9 Pro',
    supportedModes: ['Night Sight', 'Astrophotography', 'Pro controls'],
    notes: 'Use Night Sight/Astrophotography for the least fiddly phone sky setup.',
    gear: { focalLengthMm: 113, sensorWidthMm: FULL_FRAME_EQUIVALENT_SENSOR_WIDTH_MM },
  },
  'pixel-8-pro': {
    id: 'pixel-8-pro',
    maker: 'google',
    recipeFamily: 'google',
    name: 'Pixel 8 Pro',
    supportedModes: ['Night Sight', 'Astrophotography', 'Pro controls'],
    notes: 'Good astro automation when stationary, with Pro controls available on the Pro model.',
    gear: { focalLengthMm: 113, sensorWidthMm: FULL_FRAME_EQUIVALENT_SENSOR_WIDTH_MM },
  },
  'nothing-phone-3': {
    id: 'nothing-phone-3',
    maker: 'nothing',
    recipeFamily: 'nothing',
    name: 'Nothing Phone 3',
    supportedModes: ['Night mode', '50MP main', 'telephoto', 'Nothing presets'],
    notes: 'Use the main camera for dark-sky work. Nothing has visual presets, but public user preset file install is not reliably documented.',
    gear: { focalLengthMm: 70, sensorWidthMm: FULL_FRAME_EQUIVALENT_SENSOR_WIDTH_MM },
  },
  'nothing-phone-3a': {
    id: 'nothing-phone-3a',
    maker: 'nothing',
    recipeFamily: 'nothing',
    name: 'Nothing Phone 3a / 3a Pro',
    supportedModes: ['Night mode', '50MP main with OIS', '2x telephoto on 3a', '3x periscope on 3a Pro'],
    notes: 'Use main camera for dark sky and moving targets. Use telephoto for Moon/planet framing only.',
    gear: { focalLengthMm: 50, sensorWidthMm: FULL_FRAME_EQUIVALENT_SENSOR_WIDTH_MM },
  },
  'nothing-phone-2': {
    id: 'nothing-phone-2',
    maker: 'nothing',
    recipeFamily: 'nothing',
    name: 'Nothing Phone 2',
    supportedModes: ['Night mode', '50MP main', 'ultrawide'],
    notes: 'No real telephoto. Use main camera and stability.',
    gear: { focalLengthMm: 24, sensorWidthMm: FULL_FRAME_EQUIVALENT_SENSOR_WIDTH_MM },
  },
  'galaxy-s26-ultra': {
    id: 'galaxy-s26-ultra',
    maker: 'samsung',
    recipeFamily: 'samsung',
    name: 'Galaxy S26 Ultra',
    supportedModes: ['Nightography', 'Pro mode', 'Expert RAW', 'telephoto'],
    notes: 'Best Samsung path is Pro mode or Expert RAW when available; otherwise use Night mode.',
    gear: { focalLengthMm: 115, sensorWidthMm: FULL_FRAME_EQUIVALENT_SENSOR_WIDTH_MM },
  },
  'galaxy-s25-ultra': {
    id: 'galaxy-s25-ultra',
    maker: 'samsung',
    recipeFamily: 'samsung',
    name: 'Galaxy S25 Ultra',
    supportedModes: ['Nightography', 'Pro mode', 'Expert RAW', '5x telephoto'],
    notes: 'Use Expert RAW/Pro mode for repeatable astro settings.',
    gear: { focalLengthMm: 115, sensorWidthMm: FULL_FRAME_EQUIVALENT_SENSOR_WIDTH_MM },
  },
  'galaxy-s24-ultra': {
    id: 'galaxy-s24-ultra',
    maker: 'samsung',
    recipeFamily: 'samsung',
    name: 'Galaxy S24 Ultra',
    supportedModes: ['Nightography', 'Pro mode', 'Expert RAW', '5x telephoto'],
    notes: 'Strong manual path through Pro mode and Expert RAW.',
    gear: { focalLengthMm: 115, sensorWidthMm: FULL_FRAME_EQUIVALENT_SENSOR_WIDTH_MM },
  },
  'other-phone': {
    id: 'other-phone',
    maker: 'other',
    recipeFamily: 'other',
    name: 'Other Android phone',
    supportedModes: ['Night mode if available', 'manual camera app if needed'],
    notes: 'Assume no native preset install. Stability and simple setup matter most.',
    gear: { focalLengthMm: 26, sensorWidthMm: FULL_FRAME_EQUIVALENT_SENSOR_WIDTH_MM },
  },
}

const DEFAULT_DEVICE_KEY = 'atlas-default-camera-device'
const CUSTOM_FOCAL_LENGTH_KEY = 'atlas-custom-lens-focal-length-mm'

export function modelsForMaker(maker: DeviceMaker): CameraProfile[] {
  return Object.values(CAMERA_PROFILES).filter((profile) => profile.maker === maker)
}

export function makerForDevice(id: DeviceId): DeviceMaker {
  return CAMERA_PROFILES[id].maker
}

export function detectDeviceFromUserAgent(userAgent = navigator.userAgent): DeviceId {
  const ua = userAgent.toLowerCase()
  // iOS user agents do not reliably identify the exact model, so do not
  // silently claim a Pro camera profile for every iPhone.
  if (ua.includes('iphone')) return 'iphone'
  if (ua.includes('pixel')) return 'pixel-10-pro'
  if (ua.includes('samsung') || ua.includes('sm-')) return 'galaxy-s26-ultra'
  if (ua.includes('nothing') || ua.includes('a059') || ua.includes('a059p')) return 'nothing-phone-3a'
  return 'other-phone'
}

export function normalizeDeviceId(value: string | null): DeviceId | null {
  if (!value) return null
  if (value === 'generic') return 'other-phone'
  if (value in CAMERA_PROFILES) return value as DeviceId
  return null
}

export function getDefaultDevice(): DeviceId {
  return normalizeDeviceId(localStorage.getItem(DEFAULT_DEVICE_KEY)) ?? detectDeviceFromUserAgent()
}

export function setDefaultDevice(id: DeviceId) {
  localStorage.setItem(DEFAULT_DEVICE_KEY, id)
}

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

// Translate a DEVICE_PRESETS snake_case id (e.g. 'iphone_15_pro') to a
// cameraProfiles kebab-case DeviceId (e.g. 'iphone-15-pro') for trip
// equipment defaults. Only covers presets with CAMERA_PROFILES equivalents;
// others return null and are skipped in the default selection.
const PRESET_TO_DEVICE_ID: Partial<Record<string, DeviceId>> = {
  iphone_15_pro: 'iphone-15-pro',
  iphone_16_pro: 'iphone-16-pro',
  pixel_8_pro: 'pixel-8-pro',
  pixel_9_pro: 'pixel-9-pro',
  galaxy_s24_ultra: 'galaxy-s24-ultra',
  galaxy_s25_ultra: 'galaxy-s25-ultra',
  nothing_phone_2: 'nothing-phone-2',
  nothing_phone_3: 'nothing-phone-3',
  other: 'other-phone',
}

export function deviceIdFromPreset(value: string): DeviceId | null {
  return PRESET_TO_DEVICE_ID[value] ?? null
}

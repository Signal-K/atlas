// Camera setup guidance for astrophotography on phones, shown to Sky Pass
// users in Account settings for whichever device(s) they select. Most stock
// camera apps cap exposure time and disable RAW by default, which is the
// single biggest reason phone night-sky shots come out as a black frame --
// the fix differs by OEM, so a single generic guide isn't useful.
export interface DevicePreset {
  value: string
  label: string
  instructions: string[]
  presetUrl?: string
}

export const DEVICE_PRESETS: DevicePreset[] = [
  {
    value: 'nothing_phone_1',
    label: 'Nothing Phone (1)',
    instructions: [
      'Open Camera, swipe to Pro mode, set ISO to 800-1600 and shutter to 10-30s.',
      'Set focus to manual and pull it to infinity (the far end of the focus slider).',
      'Set white balance to a fixed Kelvin value (3200-4000K) rather than Auto, so it stays consistent across a sequence.',
      'Turn on the 3s timer or use the volume-button shutter to avoid shake.',
    ],
  },
  {
    value: 'nothing_phone_2',
    label: 'Nothing Phone (2)',
    instructions: [
      'Open Camera, swipe to Pro mode, set ISO to 800-1600 and shutter to 10-30s.',
      'Set focus to manual and pull it to infinity.',
      'Enable RAW capture in Pro mode settings for more headroom when editing.',
      'Use the volume-button shutter or a timer to avoid shake.',
    ],
  },
  {
    value: 'nothing_phone_2a',
    label: 'Nothing Phone (2a)',
    instructions: [
      'Open Camera, swipe to Pro mode, set ISO to 800-1600 and shutter to 10-30s.',
      'Set focus to manual and pull it to infinity.',
      'The 2a caps Pro-mode shutter lower than the 1/2 -- if 30s isn’t offered, stack multiple 10s exposures instead of one long one.',
      'Use the volume-button shutter or a timer to avoid shake.',
    ],
  },
  {
    value: 'nothing_phone_3',
    label: 'Nothing Phone (3)',
    instructions: [
      'Open Camera, swipe to Pro mode, set ISO to 800-1600 and shutter to 10-30s.',
      'Set focus to manual and pull it to infinity.',
      'Enable RAW capture in Pro mode settings for more headroom when editing.',
      'Use the volume-button shutter or a timer to avoid shake.',
    ],
  },
  {
    value: 'iphone_15_pro',
    label: 'iPhone 15 Pro',
    instructions: [
      'The stock Camera app has no manual mode -- Night mode will engage automatically in low light, but for the sky it caps around 10s and cannot be forced longer.',
      'For longer exposures, install a third-party manual-camera app that exposes ISO/shutter/RAW controls.',
      'Lock focus by tapping and holding on a bright star, then AE/AF Lock.',
      'Prop the phone against something solid or use a tripod mount -- there is no shutter delay by default, so add one in Settings > Camera > Timer if handholding.',
    ],
  },
  {
    value: 'iphone_16_pro',
    label: 'iPhone 16 Pro',
    instructions: [
      'The stock Camera app has no manual mode -- Night mode will engage automatically in low light, but for the sky it caps around 10s and cannot be forced longer.',
      'For longer exposures, install a third-party manual-camera app that exposes ISO/shutter/RAW controls.',
      'Lock focus by tapping and holding on a bright star, then AE/AF Lock.',
      'Prop the phone against something solid or use a tripod mount -- there is no shutter delay by default, so add one in Settings > Camera > Timer if handholding.',
    ],
  },
  {
    value: 'pixel_8_pro',
    label: 'Google Pixel 8 Pro',
    instructions: [
      'Open Camera, select Night Sight -- it auto-detects a dark, still scene and offers a long-exposure "Astrophotography" mode (up to 4 minutes) when the phone is on a tripod.',
      'Astrophotography mode only appears when the phone is genuinely stationary -- prop it against something solid.',
      'RAW capture can be enabled in Camera > Settings > Advanced.',
    ],
  },
  {
    value: 'pixel_9_pro',
    label: 'Google Pixel 9 Pro',
    instructions: [
      'Open Camera, select Night Sight -- Astrophotography mode kicks in automatically on a tripod-stable phone in the dark, up to 4 minutes exposure.',
      'RAW capture can be enabled in Camera > Settings > Advanced.',
      'Keep the phone still through the full capture -- it stacks multiple sub-exposures and will discard the shot if it detects movement.',
    ],
  },
  {
    value: 'galaxy_s24_ultra',
    label: 'Samsung Galaxy S24 Ultra',
    instructions: [
      'Open Camera, swipe to More > Pro or Expert RAW, set ISO to 800-1600 and shutter to the max available (typically 10-30s).',
      'Set focus to manual and pull it to infinity.',
      'Expert RAW’s Pro mode also has a dedicated Night/Astro preset that stacks multiple long exposures automatically -- use a tripod.',
    ],
  },
  {
    value: 'galaxy_s25_ultra',
    label: 'Samsung Galaxy S25 Ultra',
    instructions: [
      'Open Camera, swipe to More > Pro or Expert RAW, set ISO to 800-1600 and shutter to the max available (typically 10-30s).',
      'Set focus to manual and pull it to infinity.',
      'Expert RAW’s Pro mode also has a dedicated Night/Astro preset that stacks multiple long exposures automatically -- use a tripod.',
    ],
  },
  {
    value: 'other',
    label: 'Other / not listed',
    instructions: [
      'Look for a "Pro" or "Manual" mode in your camera app -- the setting names above (ISO, shutter speed, manual focus at infinity) apply broadly across Android phones with a Pro mode.',
      'If your stock camera has no manual mode, a third-party manual-camera app is usually the fastest path to longer exposures.',
      'Use a tripod or prop the phone against something solid -- exposures over a second or two are unusable handheld.',
    ],
  },
]

export function devicePresetFor(value: string): DevicePreset | undefined {
  return DEVICE_PRESETS.find((preset) => preset.value === value)
}

// Community astrophotography presets (STS-189, phase 3 of the camera-preset
// split -- see also STS-174 data model and STS-188 recommendation). Per the
// answered scope: start with a manually curated seed list, no live scraping
// yet. Each seed is hand-authored from general phone-astrophotography
// technique, not scraped from a specific external thread -- there is no
// confirmed external source to attribute yet, so `sourceUrl` stays unset
// until a real fetch/import pipeline exists. Seeds surface in the same
// recommendation path as builtin/imported presets (see
// recommendPresetsForTarget in cameraPresets.ts).
import type { CameraPreset } from './db'
import type { RecipeKey } from './cameraRecipes'
import type { DeviceId } from './cameraProfiles'

interface CommunityPresetSeed {
  id: string
  targetKey: RecipeKey
  device: DeviceId
  name: string
  settings: CameraPreset['settings']
  notes: string
  sourceUrl?: string
}

export const COMMUNITY_PRESET_SEEDS: CommunityPresetSeed[] = [
  {
    id: 'community-milky_way-iphone-16-pro-1',
    targetKey: 'milky_way',
    device: 'iphone-16-pro',
    name: 'Deep dark-sky Milky Way (manual app)',
    settings: { mode: 'Manual (third-party app)', lens: 'Ultra-wide', iso: 3200, exposureSec: 20 },
    notes: 'Community consensus for phone Milky Way shots: push exposure to the star-trailing limit at your focal length rather than pushing ISO further, which mostly adds noise.',
  },
  {
    id: 'community-milky_way-nothing-phone-3a-1',
    targetKey: 'milky_way',
    device: 'nothing-phone-3a',
    name: 'Night mode max-duration Milky Way',
    settings: { mode: 'Night mode, max duration', lens: 'Main', iso: 1600, exposureSec: 16 },
    notes: 'Nothing Camera night mode already multi-frame-stacks, so a moderate ISO with the longest available duration outperforms forcing a high manual ISO.',
  },
  {
    id: 'community-moon-iphone-16-pro-1',
    targetKey: 'moon',
    device: 'iphone-16-pro',
    name: 'Crisp lunar disc (manual app)',
    settings: { mode: 'Manual (third-party app)', lens: 'Telephoto (5x)', iso: 100, exposureSec: 0.008, whiteBalanceKelvin: 5600 },
    notes: 'The Moon is far brighter than the surrounding sky is metered for -- a fast shutter at base ISO avoids the blown-out disc that auto-exposure produces.',
  },
  {
    id: 'community-meteor_shower-generic-1',
    targetKey: 'meteor_shower',
    device: 'generic',
    name: 'Wide-field meteor capture (repeated frames)',
    settings: { mode: 'Night mode, repeated', lens: 'Main', exposureSec: 15 },
    notes: 'Community advice for basic phones without full manual control: prioritise a wide field of view and volume of frames over any single frame being perfect.',
  },
]

export function communityPresetsForTarget(targetKey: RecipeKey): CameraPreset[] {
  return COMMUNITY_PRESET_SEEDS.filter((seed) => seed.targetKey === targetKey).map((seed) => ({
    id: seed.id,
    userId: 'community',
    device: seed.device,
    targetKey: seed.targetKey,
    name: seed.name,
    settings: seed.settings,
    source: 'community' as const,
    sourceUrl: seed.sourceUrl,
    notes: seed.notes,
    createdAt: '2026-01-01T00:00:00.000Z',
  }))
}

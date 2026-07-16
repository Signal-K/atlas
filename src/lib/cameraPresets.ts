// Camera preset library (STS-174, phase 1 of the camera-preset-import split —
// see also STS-188 target-based recommendation and STS-189 community search).
// Structured, matchable preset data, distinct from CAMERA_RECIPES in
// cameraRecipes.ts (prose field notes per target/device). Existing recipes
// still render as-is via CameraRecipe.tsx; this module adds a parallel,
// data-driven layer that user-imported and community presets also live in.
import { pb } from './pocketbase'
import { db, type CameraPreset, type CameraPresetSettings } from './db'
import { CAMERA_RECIPES, deviceRecipeFor, type RecipeKey } from './cameraRecipes'
import { CAMERA_PROFILES, type DeviceId } from './cameraProfiles'
import { communityPresetsForTarget } from './communityPresets'

export function builtinPresetsForRecipe(recipeKey: RecipeKey): CameraPreset[] {
  const recipe = CAMERA_RECIPES[recipeKey]
  return (Object.keys(CAMERA_PROFILES) as DeviceId[]).map((device) => {
    const deviceRecipe = deviceRecipeFor(recipeKey, device)
    return {
    id: `builtin-${recipeKey}-${device}`,
    userId: 'builtin',
    device,
    targetKey: recipeKey,
    name: `${recipe.title} (${CAMERA_PROFILES[device].name})`,
    settings: {
      mode: deviceRecipe.mode,
      lens: deviceRecipe.lens,
    },
    source: 'builtin' as const,
    notes: `${deviceRecipe.exposure} — ${deviceRecipe.focus}`,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
  })
}

export async function listPresetsForUser(userId: string): Promise<CameraPreset[]> {
  return db.cameraPresets.where('userId').equals(userId).toArray()
}

export async function listPresetsForTarget(userId: string, targetKey: RecipeKey): Promise<CameraPreset[]> {
  const [builtin, userPresets] = await Promise.all([
    Promise.resolve(builtinPresetsForRecipe(targetKey)),
    db.cameraPresets.where({ userId, targetKey }).toArray(),
  ])
  return [...userPresets, ...communityPresetsForTarget(targetKey), ...builtin]
}

const SOURCE_RANK: Record<CameraPreset['source'], number> = {
  imported: 0,
  community: 1,
  builtin: 2,
}

// STS-188: rank presets for a target + device, most relevant first. A
// device-matching imported/community preset beats a device-matching
// builtin recipe, which beats a preset for a different device. The
// device-matching builtin recipe is always present (builtinPresetsForRecipe
// covers all three devices), so this never returns an empty list — that's
// the "graceful fallback to the static per-device recipe" from the AC.
export async function recommendPresetsForTarget(userId: string, targetKey: RecipeKey, device: DeviceId): Promise<CameraPreset[]> {
  const presets = await listPresetsForTarget(userId, targetKey)
  return [...presets].sort((a, b) => {
    const deviceRank = Number(a.device !== device) - Number(b.device !== device)
    if (deviceRank !== 0) return deviceRank
    return SOURCE_RANK[a.source] - SOURCE_RANK[b.source]
  })
}

export async function savePreset(preset: Omit<CameraPreset, 'id' | 'createdAt'>): Promise<CameraPreset> {
  const entry: CameraPreset = {
    ...preset,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  await db.cameraPresets.put(entry)
  await pushPreset(entry)
  return entry
}

// Best-effort immediate push when signed in and online, matching the
// pushObservation() pattern in sync.ts — failure just leaves the preset
// local-only rather than lost.
export async function pushPreset(preset: CameraPreset): Promise<void> {
  if (!pb.authStore.isValid || !navigator.onLine) return

  try {
    await pb.collection('atlas_camera_presets').create({
      user: pb.authStore.record?.id,
      device: preset.device,
      target_key: preset.targetKey,
      name: preset.name,
      settings: preset.settings,
      source: preset.source,
      source_url: preset.sourceUrl,
      notes: preset.notes,
    })
  } catch {
    // Stays local-only.
  }
}

export class PresetImportError extends Error {}

// Imports presets from a Nothing Camera export file. OPEN QUESTION (STS-174
// AC): we don't have a sample real export from the Nothing Camera app yet,
// so this parser targets a generic JSON shape (an array of settings objects,
// or a single object) rather than the app's real proprietary format. Swap
// the field-mapping below once a real sample file is available — the
// public shape (CameraPreset/CameraPresetSettings) is deliberately generic
// enough that only this function should need to change.
export function parseNothingPresetFile(fileContents: string, device: DeviceId): CameraPresetSettings[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(fileContents)
  } catch {
    throw new PresetImportError('File is not valid JSON. The Nothing Camera export format has not been confirmed yet — see the open question in this ticket.')
  }

  const rawEntries =
    typeof parsed === 'object' && parsed !== null && (parsed as Record<string, unknown>).format === 'atlas-camera-preset-bundle'
      ? [(parsed as Record<string, unknown>).settings]
      : Array.isArray(parsed)
        ? parsed
        : [parsed]

  return rawEntries.map((raw, index) => {
    if (typeof raw !== 'object' || raw === null) {
      throw new PresetImportError(`Entry ${index} is not an object.`)
    }
    const record = raw as Record<string, unknown>
    const settings: CameraPresetSettings = {
      mode: typeof record.mode === 'string' ? record.mode : undefined,
      lens: typeof record.lens === 'string' ? record.lens : undefined,
      iso: typeof record.iso === 'number' ? record.iso : undefined,
      whiteBalanceKelvin: typeof record.whiteBalanceKelvin === 'number' ? record.whiteBalanceKelvin : typeof record.white_balance === 'number' ? record.white_balance : undefined,
      exposureSec: typeof record.exposureSec === 'number' ? record.exposureSec : typeof record.exposure_sec === 'number' ? record.exposure_sec : undefined,
      filters: Array.isArray(record.filters) ? record.filters.filter((f): f is string => typeof f === 'string') : undefined,
    }
    if (Object.values(settings).every((value) => value === undefined)) {
      throw new PresetImportError(`Entry ${index} has none of the recognised preset fields (mode, lens, iso, whiteBalanceKelvin, exposureSec, filters).`)
    }
    void device
    return settings
  })
}

export async function importPresetFile(fileContents: string, userId: string, device: DeviceId, name: string, targetKey?: RecipeKey): Promise<CameraPreset[]> {
  const parsedSettings = parseNothingPresetFile(fileContents, device)
  const saved: CameraPreset[] = []
  for (const [index, settings] of parsedSettings.entries()) {
    saved.push(
      await savePreset({
        userId,
        device,
        targetKey,
        name: parsedSettings.length > 1 ? `${name} (${index + 1})` : name,
        settings,
        source: 'imported',
      }),
    )
  }
  return saved
}

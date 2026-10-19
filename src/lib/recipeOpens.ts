import type { RecipeOpen } from './progress.ts'

// ASV-90: a device-local record of "this camera recipe was opened for this
// target", so a later check-in that used the recipe can earn the advice-followed
// bonus. localStorage rather than Dexie: it is a tiny, best-effort breadcrumb
// and needs no schema bump.
const KEY = 'atlas-recipe-opens'
const MAX_OPENS = 100

export function getRecipeOpens(): RecipeOpen[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is RecipeOpen =>
        typeof item?.recipeKey === 'string' && typeof item?.target === 'string' && typeof item?.openedAt === 'string',
    )
  } catch {
    return []
  }
}

export function recordRecipeOpen(recipeKey: string, target: string, now: Date = new Date()): void {
  const trimmed = target.trim()
  if (!trimmed) return
  const rest = getRecipeOpens().filter((open) => !(open.recipeKey === recipeKey && open.target === trimmed))
  const next = [...rest, { recipeKey, target: trimmed, openedAt: now.toISOString() }].slice(-MAX_OPENS)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Best-effort: losing the breadcrumb only means no bonus for that attempt.
  }
}

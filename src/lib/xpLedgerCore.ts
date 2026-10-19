import type { ProgressAward, ProgressSkill } from './progress.ts'

// ASV-93. The pure half of the append-only XP ledger: no PocketBase, Dexie or
// browser imports, so node --test can exercise it directly. The collection's
// unique (user, action, source_id) index is the server-side guarantee; this
// module is what keeps the client from even trying to write a row twice.

export interface LedgerRow {
  action: string
  source_id: string
  skill: ProgressSkill
  points: number
  event_kind?: string
}

export interface LedgerClient {
  // Keys of rows the user already has, as produced by ledgerKey.
  listKeys(): Promise<Set<string>>
  create(row: LedgerRow): Promise<void>
}

export function ledgerKey(action: string, sourceId: string): string {
  return `${action}\u0000${sourceId}`
}

export function toLedgerRow(award: ProgressAward): LedgerRow {
  return {
    action: award.action,
    source_id: award.sourceId,
    skill: award.skill,
    points: award.points,
    ...(award.eventKind ? { event_kind: award.eventKind } : {}),
  }
}

/** Awards the ledger does not hold yet. Never returns the same key twice. */
export function missingAwards(awards: readonly ProgressAward[], existing: ReadonlySet<string>): ProgressAward[] {
  const seen = new Set(existing)
  const missing: ProgressAward[] = []
  for (const award of awards) {
    const key = ledgerKey(award.action, award.sourceId)
    if (seen.has(key)) continue
    seen.add(key)
    missing.push(award)
  }
  return missing
}

export function ledgerTotals(rows: readonly Pick<LedgerRow, 'skill' | 'points'>[]): { total: number; skills: Record<ProgressSkill, number> } {
  const skills: Record<ProgressSkill, number> = { observing: 0, photography: 0, planning: 0, community: 0 }
  for (const row of rows) skills[row.skill] += row.points
  return { total: Object.values(skills).reduce((sum, points) => sum + points, 0), skills }
}

/**
 * Appends whichever awards are missing. Safe to call after every save and to
 * retry: a row that already exists (including one a concurrent tab wrote
 * between the list and the create, which the unique index rejects) is skipped.
 * Returns the number of rows this call created.
 */
export async function syncAwards(awards: readonly ProgressAward[], client: LedgerClient): Promise<number> {
  const todo = missingAwards(awards, await client.listKeys())
  let created = 0
  for (const award of todo) {
    try {
      await client.create(toLedgerRow(award))
      created += 1
    } catch (error) {
      if (!isUniqueConflict(error)) throw error
    }
  }
  return created
}

export function isUniqueConflict(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status
  return status === 400 && /unique|already exists|duplicate/i.test(JSON.stringify((error as { response?: unknown }).response ?? ''))
}

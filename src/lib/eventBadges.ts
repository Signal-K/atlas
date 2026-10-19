import { pb } from './pocketbase'
import { orionidsActivity } from './eventSources/meteor-showers.mjs'
import {
  ATLAS_SOURCE,
  ORIONIDS_EVENT_ID,
  awardsForObservation,
  fireballAward,
  quizIsCorrect,
} from './spacetober.mjs'

const BADGES = 'event_badges'
const MASTERY = 'meteorite_mastery'

export function observerTimeZone(): string {
  try {
    const raw = localStorage.getItem('atlas-manual-location')
    if (raw) {
      const parsed = JSON.parse(raw) as { timeZone?: string }
      if (parsed.timeZone) return parsed.timeZone
    }
  } catch {
    // Fall through to the device zone.
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && (error as { status: number }).status === 404
}

interface AwardRow {
  event_id: string
  subject_id: string
  tier: 'gold' | 'silver'
  source: string
  earned_at: number
  marker: string
  voucher: string
  grantsMastery: boolean
}

async function upsertBadge(userId: string, row: AwardRow): Promise<void> {
  const filter = `user = "${userId}" && event_id = "${row.event_id}" && subject_id = "${row.subject_id}"`
  try {
    const existing = await pb.collection(BADGES).getFirstListItem(filter)
    const tier = existing.tier === 'gold' ? 'gold' : row.tier
    const marker = existing.marker || row.marker
    const voucher = existing.voucher || row.voucher
    const patch: Record<string, unknown> = {}
    if (tier !== existing.tier) patch.tier = tier
    if (marker && marker !== existing.marker) patch.marker = marker
    if (voucher && voucher !== existing.voucher) patch.voucher = voucher
    if (Object.keys(patch).length > 0) await pb.collection(BADGES).update(existing.id, patch)
  } catch (error) {
    if (!isNotFound(error)) return
    try {
      await pb.collection(BADGES).create({
        user: userId,
        event_id: row.event_id,
        subject_id: row.subject_id,
        tier: row.tier,
        source: ATLAS_SOURCE,
        earned_at: row.earned_at,
        marker: row.marker,
        voucher: row.voucher,
      })
    } catch {
      // A unique-index race means the row is already there.
    }
  }
}

async function raiseMeteoriteMastery(userId: string, eventId: string, earnedAt: number): Promise<void> {
  try {
    const existing = await pb.collection(MASTERY).getFirstListItem(`user = "${userId}"`)
    if (Number(existing.level) >= 1) return
    await pb.collection(MASTERY).update(existing.id, {
      level: 1,
      source: ATLAS_SOURCE,
      event_id: eventId,
      earned_at: earnedAt,
    })
  } catch (error) {
    if (!isNotFound(error)) return
    try {
      await pb.collection(MASTERY).create({
        user: userId,
        level: 1,
        source: ATLAS_SOURCE,
        event_id: eventId,
        earned_at: earnedAt,
      })
    } catch {
      // Unique index: Landnam or another tab already created the row.
    }
  }
}

async function persist(rows: AwardRow[], masteryEventId: string): Promise<void> {
  const userId = pb.authStore.record?.id
  if (!userId || !pb.authStore.isValid) return
  for (const row of rows) await upsertBadge(userId, row)
  if (rows.some((row) => row.grantsMastery)) {
    const earnedAt = rows.find((row) => row.grantsMastery)?.earned_at ?? Date.now()
    await raiseMeteoriteMastery(userId, masteryEventId, earnedAt)
  }
}

export function awardObservationCampaign(observedAtIso: string, hasPhoto: boolean): void {
  if (!pb.authStore.isValid) return
  const rows = awardsForObservation({
    at: new Date(observedAtIso),
    timeZone: observerTimeZone(),
    hasPhoto,
    activity: orionidsActivity(2026),
  }) as AwardRow[]
  if (rows.length === 0) return
  void persist(rows, ORIONIDS_EVENT_ID)
}

export interface FireballSubmission {
  read: boolean
  answers: number[]
  watchMinutes: number | null
  meteorCount: number | null
}

export async function awardFireballSpotter(input: FireballSubmission): Promise<{ tier: 'gold' | 'silver' } | { error: string }> {
  if (!pb.authStore.isValid) return { error: 'Sign in to keep the Fireball Spotter badge.' }
  const row = fireballAward({
    at: new Date(),
    timeZone: observerTimeZone(),
    activity: orionidsActivity(2026),
    read: input.read,
    quizCorrect: quizIsCorrect(input.answers),
    watchMinutes: input.watchMinutes ?? Number.NaN,
    meteorCount: input.meteorCount ?? Number.NaN,
  }) as AwardRow | null
  if (!row) {
    return { error: 'Read the article, then answer all three questions or log a sky watch of at least 10 minutes.' }
  }
  await persist([row], ORIONIDS_EVENT_ID)
  return { tier: row.tier }
}

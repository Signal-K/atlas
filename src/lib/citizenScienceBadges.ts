import type { ObservationLogEntry } from './db'
import { pb } from './pocketbase'
import { parsePbDate } from './pocketbaseDate'

export type BadgeTier = 'bronze' | 'silver' | 'gold'

// One SkyEvent.kind per citizen-science project, currently just Globe at
// Night's light-pollution campaigns. A second project (AAVSO, etc.) adds a
// row here rather than a new field/schema, per the same project-agnostic
// reasoning as the atlas_observations.citizen_science_project migration.
const PROJECT_BY_EVENT_KIND: Record<string, string> = {
  light_pollution_campaign: 'globe_at_night',
}

export function projectForEventKind(kind: string): string | undefined {
  return PROJECT_BY_EVENT_KIND[kind]
}

export const PROJECT_LABELS: Record<string, string> = {
  globe_at_night: 'Globe at Night',
}

// Thresholds live in one place so the Hub teaser, the Journal badge chip,
// and the share card all agree on what "gold" means -- same reasoning
// citizen-science project data model already applies (streaks.ts keeps
// currentWeeks as the only source of truth for what a "streak" is).
const TIER_THRESHOLDS: [BadgeTier, number][] = [
  ['gold', 15],
  ['silver', 5],
  ['bronze', 1],
]

export function tierForCount(count: number): BadgeTier | null {
  for (const [tier, threshold] of TIER_THRESHOLDS) {
    if (count >= threshold) return tier
  }
  return null
}

export function nextTierProgress(count: number): { tier: BadgeTier; remaining: number } | null {
  const ascending = [...TIER_THRESHOLDS].reverse()
  for (const [tier, threshold] of ascending) {
    if (count < threshold) return { tier, remaining: threshold - count }
  }
  return null
}

export interface CitizenScienceBadge {
  project: string
  count: number
  tier: BadgeTier | null
  firstSubmittedAt: string
  lastSubmittedAt: string
  remoteId?: string
  isPublic?: boolean
  shareSlug?: string
}

export interface PublicCitizenScienceBadge {
  project: string
  submissionCount: number
  tier: BadgeTier | null
  firstSubmittedAt: string
  lastSubmittedAt: string
}

function shareSlug(userId: string, project: string): string {
  return `${project}-${userId.slice(0, 8)}`
}

export function citizenScienceBadgeShareUrl(slug: string): string {
  return `${window.location.origin}/badges/${slug}`
}

// Derived from local Journal entries, same as cityStampsFromObservations --
// the badge is a read model over observations the user already has, not a
// separately-maintained counter that can drift from what's actually in the
// Journal.
export function citizenScienceBadgesFromObservations(entries: ObservationLogEntry[]): CitizenScienceBadge[] {
  const badges = new Map<string, CitizenScienceBadge>()

  for (const entry of entries) {
    const project = entry.citizenScienceProject?.trim()
    if (!project) continue

    const existing = badges.get(project)
    if (!existing) {
      badges.set(project, {
        project,
        count: 1,
        tier: tierForCount(1),
        firstSubmittedAt: entry.observedAt,
        lastSubmittedAt: entry.observedAt,
      })
      continue
    }

    existing.count += 1
    existing.tier = tierForCount(existing.count)
    if (entry.observedAt < existing.firstSubmittedAt) existing.firstSubmittedAt = entry.observedAt
    if (entry.observedAt > existing.lastSubmittedAt) existing.lastSubmittedAt = entry.observedAt
  }

  return Array.from(badges.values()).sort((a, b) => b.count - a.count)
}

// Called alongside pushCityStampFromObservation/recordWeeklyActivity from the
// capture flow whenever a submission carries a citizen-science project tag.
// Best-effort background sync -- must never interrupt the caller's save flow.
export async function pushCitizenScienceBadgeFromObservation(entry: ObservationLogEntry): Promise<void> {
  const project = entry.citizenScienceProject?.trim()
  const userId = pb.authStore.record?.id
  if (!project || !userId || !pb.authStore.isValid || !navigator.onLine) return

  try {
    const existing = await pb.collection('atlas_citizen_science_badges').getFirstListItem(`user = "${userId}" && project = "${project}"`)
    await pb.collection('atlas_citizen_science_badges').update(existing.id, {
      submission_count: Number(existing.submission_count ?? 0) + 1,
      first_submitted_at:
        typeof existing.first_submitted_at === 'string' && existing.first_submitted_at < entry.observedAt
          ? existing.first_submitted_at
          : entry.observedAt,
      last_submitted_at:
        typeof existing.last_submitted_at === 'string' && existing.last_submitted_at > entry.observedAt
          ? existing.last_submitted_at
          : entry.observedAt,
    })
  } catch {
    try {
      await pb.collection('atlas_citizen_science_badges').create({
        user: userId,
        project,
        submission_count: 1,
        first_submitted_at: entry.observedAt,
        last_submitted_at: entry.observedAt,
        public: false,
        share_slug: shareSlug(userId, project),
      })
    } catch {
      // Best-effort, same as pushCityStampFromObservation -- e.g. a
      // duplicate-key race with another tab creating the same badge row.
      // Nothing useful to do client-side; next submission updates the
      // record that won the race.
    }
  }
}

export async function shareCitizenScienceBadge(badge: CitizenScienceBadge): Promise<string> {
  const userId = pb.authStore.record?.id
  if (!userId || !pb.authStore.isValid) throw new Error('Sign in to share a badge')

  let record
  try {
    record = await pb.collection('atlas_citizen_science_badges').getFirstListItem(`user = "${userId}" && project = "${badge.project}"`)
  } catch {
    record = await pb.collection('atlas_citizen_science_badges').create({
      user: userId,
      project: badge.project,
      submission_count: badge.count,
      first_submitted_at: badge.firstSubmittedAt,
      last_submitted_at: badge.lastSubmittedAt,
      public: false,
      share_slug: shareSlug(userId, badge.project),
    })
  }

  const slug = (record.share_slug as string | undefined) || shareSlug(userId, badge.project)
  await pb.collection('atlas_citizen_science_badges').update(record.id, {
    public: true,
    share_slug: slug,
    submission_count: Math.max(Number(record.submission_count ?? 0), badge.count),
    first_submitted_at: badge.firstSubmittedAt,
    last_submitted_at: badge.lastSubmittedAt,
  })
  return citizenScienceBadgeShareUrl(slug)
}

export async function getPublicCitizenScienceBadge(slug: string): Promise<PublicCitizenScienceBadge | null> {
  try {
    const record = await pb.collection('atlas_citizen_science_badges').getFirstListItem(`share_slug = "${slug}" && public = true`)
    const submissionCount = Number(record.submission_count ?? 0)
    return {
      project: record.project as string,
      submissionCount,
      tier: tierForCount(submissionCount),
      firstSubmittedAt: parsePbDate(record.first_submitted_at as string).toISOString(),
      lastSubmittedAt: parsePbDate(record.last_submitted_at as string).toISOString(),
    }
  } catch {
    return null
  }
}

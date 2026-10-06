// ASV-127: World Space Week 2026 post badges. Derived from check-ins Atlas
// already stores (no new persistence), so they are earnable offline and for
// guests. Gold = observed on the event date itself; silver = observed on any
// later date, or the event night logged afterwards as a past check-in.

export const SPACE_WEEK_YEAR = 2026

export const SPACE_WEEK_BADGES = [
  { id: 'space-week-saturn', label: 'Saturn', kind: 'badge', date: '2026-10-07', match: /saturn/i },
  { id: 'space-week-stamp', label: 'Space Week stamp', kind: 'stamp', date: '2026-10-07', match: null },
  { id: 'space-week-draconids', label: 'Draconids evening shower', kind: 'badge', date: '2026-10-08', match: /draconid/i },
  { id: 'space-week-m31', label: 'Andromeda Galaxy (M31)', kind: 'badge', date: '2026-10-10', match: /\bm\s?-?31\b|andromeda/i },
  { id: 'space-week-new-moon', label: 'New Moon dark sky', kind: 'badge', date: '2026-10-10', match: /new\s*moon|dark[\s-]*sky/i },
]

export function spaceWeekBadgeLink(id) {
  return `/app/profile?badge=${encodeURIComponent(id)}`
}

function civilDate(observedAt) {
  return String(observedAt).slice(0, 10)
}

function counts(entry) {
  return entry.reviewStatus === undefined || entry.reviewStatus === 'not_required' || entry.reviewStatus === 'approved'
}

function matchesTarget(badge, entry) {
  if (!badge.match) return !entry.communityNightHost
  const haystack = [entry.targetName, entry.eventId, entry.note].filter(Boolean).join(' ')
  return badge.match.test(haystack)
}

function tierFor(badge, entry) {
  const date = civilDate(entry.observedAt)
  if (date < badge.date) return null
  if (date === badge.date && entry.checkInKind !== 'past') return 'gold'
  return 'silver'
}

export function evaluateSpaceWeekBadges(observations) {
  return SPACE_WEEK_BADGES.map((badge) => {
    let tier = null
    let earnedFrom = null
    for (const entry of observations) {
      if (!counts(entry) || !matchesTarget(badge, entry)) continue
      const next = tierFor(badge, entry)
      if (next === 'gold' || (next === 'silver' && tier === null)) {
        tier = next
        earnedFrom = entry.id
        if (tier === 'gold') break
      }
    }
    return { id: badge.id, label: badge.label, kind: badge.kind, date: badge.date, tier, earnedFrom, link: spaceWeekBadgeLink(badge.id) }
  })
}

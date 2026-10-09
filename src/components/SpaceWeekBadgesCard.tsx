import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { db } from '../lib/db'
import { evaluateSpaceWeekBadges, SPACE_WEEK_BADGES } from '../lib/spaceWeekBadges.mjs'
import type { SpaceWeekBadgeState } from '../lib/spaceWeekBadges.mjs'

const LOCAL_USER_ID = 'local'
const TIER_LABEL = { gold: 'Gold', silver: 'Silver' } as const

function formatDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function SpaceWeekBadgesCard() {
  const { user } = useAuth()
  const { search } = useLocation()
  const focusId = new URLSearchParams(search).get('badge')
  const userId = user?.id ?? LOCAL_USER_ID
  const [badges, setBadges] = useState<SpaceWeekBadgeState[]>(() => evaluateSpaceWeekBadges([]))

  useEffect(() => {
    let cancelled = false
    db.observations
      .where('userId')
      .equals(userId)
      .toArray()
      .then((rows) => {
        if (!cancelled) setBadges(evaluateSpaceWeekBadges(rows))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    if (!focusId || !SPACE_WEEK_BADGES.some((badge) => badge.id === focusId)) return
    document.getElementById(focusId)?.scrollIntoView({ block: 'center' })
  }, [focusId, badges])

  return (
    <section className="az-card" style={{ marginTop: '0.75rem' }} aria-label="World Space Week badges">
      <div className="az-card-body">
        <span className="az-kicker">World Space Week</span>
        <p className="az-muted" style={{ margin: '0.25rem 0 0.75rem', fontSize: '0.8125rem' }}>
          Gold if you check in on the day, silver any time after.
        </p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.375rem' }}>
          {badges.map((badge) => (
            <li
              key={badge.id}
              id={badge.id}
              data-space-week-badge={badge.id}
              data-tier={badge.tier ?? 'open'}
              data-focused={badge.id === focusId ? 'true' : undefined}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '0.75rem',
                fontSize: '0.8125rem',
                opacity: badge.tier ? 1 : 0.65,
                fontWeight: badge.id === focusId ? 600 : undefined,
              }}
            >
              <span>
                {badge.label} <span className="az-muted">· {formatDate(badge.date)}</span>
              </span>
              <span className="az-muted">{badge.tier ? TIER_LABEL[badge.tier] : 'To do'}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

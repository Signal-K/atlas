import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { db } from '../lib/db'
import { getActiveTripPlan } from '../lib/tripPlans'
import { resolveSightingKinds } from '../lib/progressSnapshot'
import { getRecipeOpens } from '../lib/recipeOpens'
import { categoryForKind } from '../lib/eventCategories'
import { PROGRESS_SKILLS, projectProgress } from '../lib/progress'
import type { ProgressSkill, ProgressSummary } from '../lib/progress'

const LOCAL_USER_ID = 'local'

const SKILL_LABELS: Record<ProgressSkill, string> = {
  observing: 'Observing',
  photography: 'Photography',
  planning: 'Planning',
  community: 'Community',
}

// Meters have no fixed cap: each is scaled against the top level threshold so
// a bar reads as "share of the way to the highest level", not a per-skill max.
const METER_SCALE = 300

const KIND_LABELS: Record<string, string> = {
  conjunction: 'Conjunctions',
  planet_event: 'Planets',
  bright_star: 'Stars',
}

function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? categoryForKind(kind)?.label ?? kind
}

export function ProgressCard() {
  const { user } = useAuth()
  const [summary, setSummary] = useState<ProgressSummary | null>(null)
  const userId = user?.id ?? LOCAL_USER_ID
  const firstTourBadge = user?.firstTourBadge ?? null

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [observations, tripPlan] = await Promise.all([
        db.observations.where('userId').equals(userId).toArray(),
        user ? getActiveTripPlan() : Promise.resolve(null),
      ])
      const sightingKinds = await resolveSightingKinds(observations)
      if (!cancelled) setSummary(projectProgress({ observations, tripPlan, firstTourBadge, sightingKinds, recipeOpens: getRecipeOpens() }))
    }
    load().catch(() => {
      if (!cancelled) setSummary(projectProgress({ observations: [], firstTourBadge }))
    })
    return () => {
      cancelled = true
    }
  }, [user, userId, firstTourBadge])

  if (!summary) return null

  const isEmpty = summary.totalPoints === 0

  return (
    <section className="az-card" style={{ marginTop: '0.75rem' }} aria-label="Your level">
      <div className="az-card-body">
        <span className="az-kicker">Level</span>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', margin: '0.25rem 0 0.5rem' }}>
          <strong style={{ fontSize: '1.25rem' }}>Level {summary.level}</strong>
          <span className="az-muted" style={{ fontSize: '0.8125rem' }}>
            {summary.totalPoints} pts
          </span>
        </div>

        {isEmpty ? (
          <p className="az-muted" style={{ margin: 0, fontSize: '0.8125rem' }}>
            Log tonight to earn your first points.
          </p>
        ) : (
          <>
            <p className="az-muted" style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem' }}>
              {summary.nextLevelAt === null
                ? 'Top level reached.'
                : `${summary.pointsToNextLevel} pts to level ${summary.level + 1}`}
            </p>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {PROGRESS_SKILLS.map((skill) => (
                <div key={skill}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span>{SKILL_LABELS[skill]}</span>
                    <span className="az-muted">{summary.skills[skill]}</span>
                  </div>
                  {skill === 'observing' &&
                    Object.entries(summary.observingByKind).map(([kind, points]) => (
                      <div key={kind} data-observing-kind={kind} className="az-muted" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', paddingLeft: '0.5rem' }}>
                        <span>{kindLabel(kind)}</span>
                        <span>{points}</span>
                      </div>
                    ))}
                  <div
                    role="meter"
                    aria-label={SKILL_LABELS[skill]}
                    aria-valuemin={0}
                    aria-valuemax={METER_SCALE}
                    aria-valuenow={Math.min(summary.skills[skill], METER_SCALE)}
                    style={{ height: '0.375rem', borderRadius: '999px', background: 'var(--az-hairline, rgba(127,127,127,0.25))', overflow: 'hidden' }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, (summary.skills[skill] / METER_SCALE) * 100)}%`,
                        background: 'linear-gradient(90deg, var(--az-violet), var(--az-teal))',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <ul style={{ listStyle: 'none', margin: '0.875rem 0 0', padding: 0, display: 'grid', gap: '0.375rem' }}>
          {summary.milestones.map((milestone) => {
            const locked = milestone.id === 'first-community-night'
            return (
              <li
                key={milestone.id}
                data-milestone={milestone.id}
                data-state={milestone.achieved ? 'achieved' : locked ? 'locked' : 'open'}
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', opacity: milestone.achieved ? 1 : 0.6 }}
              >
                <span>{milestone.label}</span>
                <span className="az-muted">{milestone.achieved ? 'Done' : locked ? 'Locked' : 'To do'}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

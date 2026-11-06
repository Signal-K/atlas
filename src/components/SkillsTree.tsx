import { buildTrainingPath, evaluateTrainingPath } from '../lib/trainingPath'
import type { ObservationLogEntry } from '../lib/db'
import { useEffect, useState } from 'react'
import { resolveSightingKinds } from '../lib/progressSnapshot'

export function SkillsTree({ entries }: { entries: ObservationLogEntry[] }) {
  const [sightingKinds, setSightingKinds] = useState<Record<string, string>>({})
  useEffect(() => {
    let active = true
    void resolveSightingKinds(entries).then(kinds => { if (active) setSightingKinds(kinds) }).catch(() => { if (active) setSightingKinds({}) })
    return () => { active = false }
  }, [entries])
  const steps = evaluateTrainingPath(buildTrainingPath({ experienceLevel: null, interestKinds: [], purposeChips: [] }), { observations: entries, sightingKinds })
  return <section className="skills-tree" aria-label="Observing skills"><p className="document-intro">Build your observing skills through nights outside. Progress comes from your journal, not a checklist.</p>{steps.map((step, index) => <article className="skill-node" key={step.id}><span className="skill-number" aria-hidden="true">{index + 1}</span><div><p className="skill-status">{step.done ? 'Experienced' : 'To explore'}</p><h2>{step.title}</h2><p>{step.detail}</p></div></article>)}</section>
}

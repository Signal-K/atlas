import { useEffect, useState } from 'react'
import { opportunitiesFor, type CitizenScienceOpportunity } from '../../lib/citizenScience'
import { getUpcomingEvents } from '../../lib/sync'
import { HubIcon } from './HubIcon'

// Folded in from the old desktop widget stack (CitizenScienceWidget) so
// real research opportunities tied to what's actually coming up aren't lost
// now that Today is HubView everywhere.
export function CitizenScienceSection() {
  const [opportunities, setOpportunities] = useState<CitizenScienceOpportunity[] | null>(null)

  useEffect(() => {
    let cancelled = false
    getUpcomingEvents(30).then((events) => {
      if (cancelled) return
      setOpportunities(opportunitiesFor(events.map((event) => event.kind)))
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!opportunities || opportunities.length === 0) return null

  return (
    <>
      <div className="dt-stitch" />
      <section>
      <div className="dt-section-eyebrow">
        <HubIcon name="eye" />
        Citizen science
      </div>
      <p className="dt-empty-hint">Real research you can help with, tied to what&rsquo;s up right now.</p>
      {opportunities.map((opportunity) => (
        <a
          key={opportunity.id}
          href={opportunity.url}
          target="_blank"
          rel="noreferrer"
          className="dt-feed-row"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div className="dt-feed-headline-row">
            <span className="dt-feed-headline">{opportunity.title}</span>
            <span className="dt-feed-chevron">↗</span>
          </div>
          <span className="dt-feed-meta">{opportunity.description}</span>
        </a>
      ))}
      </section>
    </>
  )
}

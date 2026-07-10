import { useEffect, useState } from 'react'
import { registerWidget } from './registry'
import { opportunitiesFor, type CitizenScienceOpportunity } from '../lib/citizenScience'
import { getUpcomingEvents } from '../lib/sync'

function CitizenScienceWidget() {
  const [opportunities, setOpportunities] = useState<CitizenScienceOpportunity[] | null>(null)

  useEffect(() => {
    let cancelled = false
    getUpcomingEvents(30).then((events) => {
      if (cancelled) return
      const kinds = events.map((event) => event.kind)
      setOpportunities(opportunitiesFor(kinds))
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (opportunities === null) return <p>Loading&hellip;</p>

  return (
    <ul className="row-list citizen-science-list">
      {opportunities.map((opportunity) => (
        <li key={opportunity.id} className="citizen-science-item">
          <a href={opportunity.url} target="_blank" rel="noreferrer" className="row-text">
            {opportunity.title}
          </a>
          <p className="scrapbook-hint">{opportunity.description}</p>
        </li>
      ))}
    </ul>
  )
}

registerWidget({
  id: 'citizen-science',
  title: 'Citizen-science opportunities',
  Component: CitizenScienceWidget,
  defaultEnabled: true,
})

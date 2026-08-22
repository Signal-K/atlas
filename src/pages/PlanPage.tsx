import { PlanTripView } from '../views/PlanTripView'

export function PlanPage() {
  return (
    <div className="page">
      <header className="page-header">
        <h1>Plan a trip</h1>
        <p>Multi-city trip planning with a personalized sky guide per city -- a Sky Pass perk.</p>
      </header>

      <PlanTripView />
    </div>
  )
}

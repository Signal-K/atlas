import './../widgets/UpcomingEventsWidget'
import { listWidgets } from '../widgets/registry'
import { OnboardingCTA } from '../components/OnboardingCTA'

export function DashboardView({ onSignUpClick }: { onSignUpClick: () => void }) {
  const widgets = listWidgets()

  return (
    <div className="widget-stack">
      <OnboardingCTA onSignUpClick={onSignUpClick} />
      {widgets.map(({ id, title, Component }) => (
        <section key={id} className="widget-section">
          <h2>{title}</h2>
          <Component />
        </section>
      ))}
    </div>
  )
}

import './../widgets/UpcomingEventsWidget'
import { listWidgets } from '../widgets/registry'

export function DashboardView() {
  const widgets = listWidgets()

  return (
    <div className="widget-stack">
      {widgets.map(({ id, title, Component }) => (
        <section key={id} className="widget-section">
          <h2>{title}</h2>
          <Component />
        </section>
      ))}
    </div>
  )
}

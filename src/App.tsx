import './widgets/UpcomingEventsWidget'
import { listWidgets } from './widgets/registry'
import { Starfield } from './components/Starfield'
import { ThemeToggle } from './components/ThemeToggle'
import './App.css'

function App() {
  const widgets = listWidgets()

  return (
    <>
      <Starfield />
      <main className="dashboard">
        <header>
          <div className="dashboard-title">
            <h1>Atlas</h1>
            <ThemeToggle />
          </div>
          <p className="dashboard-subtitle">Sky events, calendar, watchlist, and weather &mdash; offline-first.</p>
        </header>
        <hr className="hairline" />
        <div className="widget-stack">
          {widgets.map(({ id, title, Component }) => (
            <section key={id} className="widget-section">
              <h2>{title}</h2>
              <Component />
            </section>
          ))}
        </div>
      </main>
    </>
  )
}

export default App

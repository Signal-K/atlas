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
          <p>Sky events, calendar, watchlist, and weather &mdash; offline-first.</p>
        </header>
        <section className="widget-grid">
          {widgets.map(({ id, title, Component }) => (
            <article key={id} className="widget-card">
              <h2>{title}</h2>
              <Component />
            </article>
          ))}
        </section>
      </main>
    </>
  )
}

export default App

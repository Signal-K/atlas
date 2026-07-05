import './widgets/PlaceholderWidget'
import { listWidgets } from './widgets/registry'
import './App.css'

function App() {
  const widgets = listWidgets()

  return (
    <main className="dashboard">
      <header>
        <h1>Atlas</h1>
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
  )
}

export default App

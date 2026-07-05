import { registerWidget } from './registry'

function PlaceholderWidget() {
  return (
    <div className="widget widget--placeholder">
      <p>No widgets registered yet. Event, watchlist, weather, streak, and citizen-science widgets land in AT-005–AT-009.</p>
    </div>
  )
}

registerWidget({
  id: 'placeholder',
  title: 'Getting started',
  Component: PlaceholderWidget,
  defaultEnabled: true,
})

import { MOCK_EVENTS } from '../lib/mockEvents'

export function EventsPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Events</h1>
        <p>What's coming up in the sky. Placeholder data for now.</p>
      </div>

      <ul className="ui-list">
        {MOCK_EVENTS.map((event) => (
          <li key={event.id} className="ui-list-item">
            <div className="ui-feed-row">
              <div className="ui-feed-top">
                <span className="ui-feed-kicker">{event.kind}</span>
                <span className="ui-feed-time">{event.when}</span>
              </div>
              <span className="ui-feed-headline">{event.title}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

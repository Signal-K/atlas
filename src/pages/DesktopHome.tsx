import { useState } from 'react'
import { EventsPage, type EventsPageProps } from './EventsPage'
import { CalendarPage } from './CalendarPage'
import { FeedView } from '../views/FeedView'
import { HubPage } from './HubPage'

export function DesktopHome({ onOpenLocation, ...props }: EventsPageProps & { onOpenLocation: () => void }) {
  const [tab, setTab] = useState<'events' | 'community' | 'tonight'>('events')
  return (
    <div className="desktop-workspace">
      <section className="desktop-feed" aria-label="Your sky feed">
        <header className="desktop-feed-heading">
          <p className="az-kicker">A little closer to the universe</p>
          <h1>Your sky, worth stepping out for.</h1>
          <p>Find something to look forward to. Make room for it in your calendar.</p>
        </header>
        <div className="desktop-feed-tabs" role="group" aria-label="Feed">
          <button type="button" aria-pressed={tab === 'events'} onClick={() => setTab('events')}>Sky events</button>
          <button type="button" aria-pressed={tab === 'community'} onClick={() => setTab('community')}>Community</button>
          <button type="button" aria-pressed={tab === 'tonight'} onClick={() => setTab('tonight')}>Tonight</button>
        </div>
        {tab === 'events' ? <EventsPage {...props} feed /> : tab === 'community' ? <FeedView /> : <HubPage city={props.city} onLogAttempt={props.onLogAttempt} onOpenLocation={onOpenLocation} />}
      </section>
      <aside className="desktop-agenda" aria-label="Your calendar">
        <CalendarPage city={props.city} compact />
        <div className="desktop-agenda-note"><span aria-hidden="true">✦</span><p>A night outside starts with a plan.<br />Save an event from your feed to keep it here.</p></div>
      </aside>
    </div>
  )
}

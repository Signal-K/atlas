import { AskAtlas } from '../components/AskAtlas'
import { useAuth } from '../lib/auth'

export function AskAtlasPage() {
  const { user } = useAuth()

  return (
    <div className="page">
      <header className="page-header">
        <h1>Ask Atlas</h1>
        <p>Ask about tonight&rsquo;s sky, an event, or your camera setup. A Sky Pass perk.</p>
      </header>

      {user && <AskAtlas entitled={user.entitled} />}
    </div>
  )
}

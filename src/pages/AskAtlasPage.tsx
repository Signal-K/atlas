import { AskAtlas } from '../components/AskAtlas'
import { useAuth } from '../lib/auth'

export function AskAtlasPage() {
  const { user } = useAuth()

  return (
    <div className="az-page">
      <p className="az-kicker">Sky Pass guide</p>
      <h1 className="az-h1">Ask Atlas</h1>
      <p className="az-hero-title">One clear answer for tonight, an event, or the gear you have.</p>

      {user && <AskAtlas entitled={user.entitled} />}
    </div>
  )
}

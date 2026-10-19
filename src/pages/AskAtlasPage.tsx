import { AskAtlas } from '../components/AskAtlas'
import { useAuth } from '../lib/auth'

export function AskAtlasPage() {
  const { user } = useAuth()

  return (
    <div className="az-page">
      <p className="az-kicker">Sky guide</p>
      <h1 className="az-h1">Ask Atlas</h1>
      <p className="az-hero-title">One clear answer for tonight, an event, or the gear you have.</p>

      <AskAtlas entitled={Boolean(user?.entitled)} guest={!user} />
    </div>
  )
}

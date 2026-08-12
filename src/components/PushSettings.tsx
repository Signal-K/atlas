import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { getPushSubscription, isIOSSafariNotStandalone, isPushSupported, subscribeToPush, unsubscribeFromPush } from '../lib/push'

export function PushSettings() {
  const { user } = useAuth()
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPushSubscription().then((sub) => setSubscribed(sub != null))
  }, [])

  async function toggle() {
    setBusy(true)
    setError(null)
    try {
      if (subscribed) await unsubscribeFromPush()
      else await subscribeToPush()
      setSubscribed(!subscribed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  if (!isPushSupported()) {
    // iOS Safari only grants the Push API to a page opened from its Home
    // Screen icon -- a plain browser tab (even after "Add to Home Screen"
    // was used, if you're still viewing it in Safari rather than the
    // installed icon) will never see PushManager, on any iOS version.
    if (isIOSSafariNotStandalone()) {
      return (
        <div className="settings-row">
          <span className="settings-label">Watchlist push notifications</span>
          <span className="settings-status">
            Add Atlas to your Home Screen first: tap Share, then "Add to Home Screen," then open Atlas from that icon
            (not from Safari) to enable notifications.
          </span>
        </div>
      )
    }
    return (
      <div className="settings-row">
        <span className="settings-label">Watchlist push notifications</span>
        <span className="settings-status">Not supported on this browser</span>
      </div>
    )
  }

  return (
    <div className="settings-row">
      <span className="settings-label">Watchlist push notifications</span>
      <div className="settings-choice">
        <span
          className={`settings-status ${
            error ? 'settings-status--negative' : subscribed ? 'settings-status--positive' : ''
          }`}
        >
          {!user ? 'Sign in required' : error ? error : subscribed ? 'Enabled' : 'Not enabled'}
        </span>
        {user && (
          <button type="button" onClick={toggle} disabled={busy}>
            {subscribed ? 'Disable' : 'Enable'}
          </button>
        )}
      </div>
    </div>
  )
}

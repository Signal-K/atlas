import { useOnlineStatus } from '../lib/useOnlineStatus'

// App-wide "you're offline" indicator. Individual views (e.g. Tonight)
// already say more specifically what's stale/cached when offline; this is
// the fallback so every other screen (community feed, sharing, widgets that
// hit PocketBase directly with no local cache) doesn't fail silently with
// no explanation at all.
export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  if (isOnline) return null

  return (
    <div className="offline-banner" role="status">
      You&apos;re offline — showing cached data where available. Some features (community feed, sharing, sign-in)
      need a connection.
    </div>
  )
}

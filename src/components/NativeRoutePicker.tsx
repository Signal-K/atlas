import { useState } from 'react'
import type { DarkSkySite } from '../lib/darkSky'
import {
  copyCoordinates,
  getPreferredMapProvider,
  getPreferredRouteMode,
  routeUrl,
  setPreferredMapProvider,
  setPreferredRouteMode,
  type MapProvider,
  type RouteMode,
} from '../lib/nativeMaps'
import { trackEvent } from '../lib/analytics'

const PROVIDERS: Array<{ id: MapProvider; label: string }> = [
  { id: 'apple', label: 'Apple' },
  { id: 'google', label: 'Google' },
]

const MODES: Array<{ id: RouteMode; label: string }> = [
  { id: 'driving', label: 'Drive' },
  { id: 'transit', label: 'Transit' },
  { id: 'walking', label: 'Walk' },
]

export function NativeRoutePicker({ site, origin, compact = false }: { site: DarkSkySite; origin?: { lat: number; lon: number }; compact?: boolean }) {
  const [provider, setProvider] = useState<MapProvider>(() => getPreferredMapProvider())
  const [mode, setMode] = useState<RouteMode>(() => getPreferredRouteMode())
  const [copyStatus, setCopyStatus] = useState('')
  const href = routeUrl({ site, origin, provider, mode })

  function chooseProvider(nextProvider: MapProvider) {
    setProvider(nextProvider)
    setPreferredMapProvider(nextProvider)
    setCopyStatus('')
  }

  function chooseMode(nextMode: RouteMode) {
    setMode(nextMode)
    setPreferredRouteMode(nextMode)
    setCopyStatus('')
  }

  async function handleCopy() {
    await copyCoordinates(site)
    setCopyStatus('Copied')
    trackEvent('Copied dark-sky coordinates', { site: site.id })
  }

  function handleOpen() {
    trackEvent('Opened dark-sky directions', { site: site.id, mode, provider })
  }

  return (
    <div className={`native-route-picker${compact ? ' native-route-picker--compact' : ''}`}>
      <div className="native-route-segment" aria-label="Map app">
        {PROVIDERS.map((item) => (
          <button
            type="button"
            key={item.id}
            className={provider === item.id ? 'is-active' : ''}
            onClick={() => chooseProvider(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="native-route-segment" aria-label="Route mode">
        {MODES.map((item) => (
          <button type="button" key={item.id} className={mode === item.id ? 'is-active' : ''} onClick={() => chooseMode(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="native-route-actions">
        <a href={href} target="_blank" rel="noreferrer" onClick={handleOpen}>
          Open {mode === 'driving' ? 'Drive' : mode === 'walking' ? 'Walk' : 'Transit'} Route
        </a>
        <button type="button" onClick={handleCopy}>
          {copyStatus || 'Copy coordinates'}
        </button>
      </div>
    </div>
  )
}

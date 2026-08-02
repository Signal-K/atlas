import type { LocationStatus } from '../lib/geo'
import type { City } from '../lib/cities'
import type { CurrentLocation } from '../lib/currentLocation'
import { AccountSettings } from './AccountSettings'
import { ThemeSettings } from '../components/ThemeSettings'
import { LocationSettings } from '../components/LocationSettings'
import { WidgetSettings } from '../components/WidgetSettings'
import { PushSettings } from '../components/PushSettings'
import { LeaderboardSettings } from '../components/LeaderboardSettings'

interface SettingsViewProps {
  locationStatus: LocationStatus
  requestLocation: () => void
  currentLocation: CurrentLocation
  manualCity: City | null
  setManualLocation: (city: City | null) => void
  needsMotionPermission: boolean
  requestMotionPermission: () => void
  accountDefaultMode?: 'sign-in' | 'sign-up'
}

export function SettingsView({
  locationStatus,
  requestLocation,
  currentLocation,
  manualCity,
  setManualLocation,
  needsMotionPermission,
  requestMotionPermission,
  accountDefaultMode,
}: SettingsViewProps) {
  return (
    <section className="widget-section settings-panel">
      <details className="settings-group" data-group="account" open>
        <summary className="calendar-selected-heading">Account</summary>
        <AccountSettings defaultMode={accountDefaultMode} source="settings" />
      </details>

      <details className="settings-group" data-group="appearance" open>
        <summary className="calendar-selected-heading">Appearance</summary>
        <ThemeSettings />
      </details>

      {/* Location and motion parallax are both device-permission toggles
          Atlas needs to build tonight's plan and the AR-style sky pointing
          -- grouped together instead of splitting motion parallax off into
          "Notifications", which it has nothing to do with. */}
      <details className="settings-group" data-group="location" open>
        <summary className="calendar-selected-heading">Location &amp; sensors</summary>
        <LocationSettings
          locationStatus={locationStatus}
          requestLocation={requestLocation}
          currentLocation={currentLocation}
          manualCity={manualCity}
          setManualLocation={setManualLocation}
          needsMotionPermission={needsMotionPermission}
          requestMotionPermission={requestMotionPermission}
        />
      </details>

      <details className="settings-group" data-group="notifications">
        <summary className="calendar-selected-heading">Notifications</summary>
        <PushSettings />
      </details>

      <details className="settings-group" data-group="leaderboard">
        <summary className="calendar-selected-heading">Streak leaderboard</summary>
        <LeaderboardSettings />
      </details>

      <details className="settings-group" data-group="widgets">
        <summary className="calendar-selected-heading">Dashboard widgets</summary>
        <WidgetSettings />
      </details>
    </section>
  )
}

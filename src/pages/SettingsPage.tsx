import { AccountSettings } from '../views/AccountSettings'
import { ThemeSettings } from '../components/ThemeSettings'
import { LocationSettings } from '../components/LocationSettings'
import { PushSettings } from '../components/PushSettings'
import { LeaderboardSettings } from '../components/LeaderboardSettings'
import { DeviceSettings } from '../components/DeviceSettings'
import { Card } from '../ui/Card'
import { useAuth } from '../lib/auth'
import type { LocationStatus } from '../lib/geo'
import type { City } from '../lib/cities'
import type { CurrentLocation } from '../lib/currentLocation'

export interface SettingsPageProps {
  locationStatus: LocationStatus
  requestLocation: () => void
  currentLocation: CurrentLocation
  manualCity: City | null
  setManualLocation: (city: City | null) => void
  needsMotionPermission: boolean
  requestMotionPermission: () => void
  accountDefaultMode?: 'sign-in' | 'sign-up'
}

const SECTIONS: Array<{ id: string; title: string }> = [
  { id: 'account', title: 'Account' },
  { id: 'devices', title: 'Device & camera setup' },
  { id: 'appearance', title: 'Appearance' },
  { id: 'location', title: 'Location & sensors' },
  { id: 'notifications', title: 'Notifications' },
  { id: 'leaderboard', title: 'Streak leaderboard' },
]

export function SettingsPage({
  locationStatus,
  requestLocation,
  currentLocation,
  manualCity,
  setManualLocation,
  needsMotionPermission,
  requestMotionPermission,
  accountDefaultMode,
}: SettingsPageProps) {
  const { user } = useAuth()

  return (
    <div className="page">
      <header className="page-header">
        <h1>Settings</h1>
        <p>Account, appearance, location, notifications, and leaderboard preferences.</p>
      </header>

      {SECTIONS.map((section) => {
        if (section.id === 'devices' && !user) return null
        return (
          <Card key={section.id} className="settings-section">
            <h2 className="settings-section-title">{section.title}</h2>
            {section.id === 'account' && <AccountSettings defaultMode={accountDefaultMode} source="settings" />}
            {section.id === 'devices' && user && <DeviceSettings deviceModels={user.deviceModels} entitled={user.entitled} />}
            {section.id === 'appearance' && <ThemeSettings />}
            {section.id === 'location' && (
              <LocationSettings
                locationStatus={locationStatus}
                requestLocation={requestLocation}
                currentLocation={currentLocation}
                manualCity={manualCity}
                setManualLocation={setManualLocation}
                needsMotionPermission={needsMotionPermission}
                requestMotionPermission={requestMotionPermission}
              />
            )}
            {section.id === 'notifications' && <PushSettings />}
            {section.id === 'leaderboard' && <LeaderboardSettings />}
          </Card>
        )
      })}
    </div>
  )
}

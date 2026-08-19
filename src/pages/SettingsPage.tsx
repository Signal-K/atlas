import { useState } from 'react'
import { AccountSettings } from '../views/AccountSettings'
import { AskAtlas } from '../components/AskAtlas'
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

type SettingsSection = 'location' | 'notifications' | 'appearance' | 'devices' | 'ask' | 'leaderboard' | 'account'

const SECTIONS: Array<{ id: SettingsSection; title: string; shortTitle: string }> = [
  { id: 'location', title: 'Location & sensors', shortTitle: 'Location' },
  { id: 'notifications', title: 'Notifications', shortTitle: 'Alerts' },
  { id: 'appearance', title: 'Appearance', shortTitle: 'Appearance' },
  { id: 'devices', title: 'Device & camera setup', shortTitle: 'Camera' },
  { id: 'ask', title: 'Ask Atlas', shortTitle: 'Ask Atlas' },
  { id: 'leaderboard', title: 'Streak leaderboard', shortTitle: 'Community' },
  { id: 'account', title: 'Account', shortTitle: 'Account' },
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
  const [activeSection, setActiveSection] = useState<SettingsSection>('location')
  const availableSections = SECTIONS.filter((section) => section.id !== 'devices' || Boolean(user))
  const section = availableSections.find((candidate) => candidate.id === activeSection) ?? availableSections[0]

  function contentFor(id: SettingsSection) {
    switch (id) {
      case 'account':
        return <AccountSettings defaultMode={accountDefaultMode} source="settings" />
      case 'devices':
        return user ? <DeviceSettings deviceModels={user.deviceModels} entitled={user.entitled} /> : null
      case 'appearance':
        return <ThemeSettings />
      case 'location':
        return (
          <LocationSettings
            locationStatus={locationStatus}
            requestLocation={requestLocation}
            currentLocation={currentLocation}
            manualCity={manualCity}
            setManualLocation={setManualLocation}
            needsMotionPermission={needsMotionPermission}
            requestMotionPermission={requestMotionPermission}
          />
        )
      case 'notifications':
        return <PushSettings />
      case 'leaderboard':
        return <LeaderboardSettings />
      case 'ask':
        return <AskAtlas entitled={Boolean(user?.entitled)} />
    }
  }

  return (
    <div className="page settings-page">
      <header className="page-header settings-page-header">
        <h1>Settings</h1>
        <p>Choose what you want to manage. Your account is available here, without taking over the page.</p>
      </header>

      <div className="settings-section-nav" role="tablist" aria-label="Settings sections">
        {availableSections.map((item) => (
          <button
            type="button"
            key={item.id}
            role="tab"
            aria-selected={section.id === item.id}
            className={`settings-section-tab${section.id === item.id ? ' is-active' : ''}`}
            onClick={() => setActiveSection(item.id)}
          >
            {item.shortTitle}
          </button>
        ))}
      </div>

      {section.id === 'ask' ? (
        <div className="settings-ask-section">
          <h2 className="settings-section-title">{section.title}</h2>
          {contentFor(section.id)}
        </div>
      ) : (
        <Card className="settings-section settings-active-section">
          <h2 className="settings-section-title">{section.title}</h2>
          {contentFor(section.id)}
        </Card>
      )}
    </div>
  )
}

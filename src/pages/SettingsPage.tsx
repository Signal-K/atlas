import { useState } from 'react'
import { AccountSettings } from '../views/AccountSettings'
import { AskAtlas } from '../components/AskAtlas'
import { ThemeSettings } from '../components/ThemeSettings'
import { LocationSettings } from '../components/LocationSettings'
import { PushSettings } from '../components/PushSettings'
import { LeaderboardSettings } from '../components/LeaderboardSettings'
import { DeviceSettings } from '../components/DeviceSettings'
import { AskAtlasIcon } from '../ui/icons'
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

const SECTION_GROUPS: Array<{ title: string; ids: SettingsSection[] }> = [
  { title: 'Personal', ids: ['location', 'appearance', 'devices'] },
  { title: 'Atlas', ids: ['notifications', 'ask', 'leaderboard'] },
  { title: 'Account', ids: ['account'] },
]

const icon = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
}

const SECTIONS: Array<{ id: SettingsSection; title: string; shortTitle: string; icon: React.ReactNode }> = [
  {
    id: 'location',
    title: 'Location & sensors',
    shortTitle: 'Location',
    icon: (
      <svg {...icon}>
        <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" />
        <circle cx="12" cy="9.5" r="2.4" />
      </svg>
    ),
  },
  {
    id: 'notifications',
    title: 'Notifications',
    shortTitle: 'Alerts',
    icon: (
      <svg {...icon}>
        <path d="M6 9a6 6 0 0 1 12 0c0 4.2 1.2 5.8 2 6.8H4c.8-1 2-2.6 2-6.8Z" />
        <path d="M10 19a2 2 0 0 0 4 0" />
      </svg>
    ),
  },
  {
    id: 'appearance',
    title: 'Appearance',
    shortTitle: 'Appearance',
    icon: (
      <svg {...icon}>
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7" />
      </svg>
    ),
  },
  {
    id: 'devices',
    title: 'Device & camera setup',
    shortTitle: 'Camera',
    icon: (
      <svg {...icon}>
        <rect x="3" y="7" width="18" height="13" rx="2.2" />
        <path d="M8 7 9.6 4h4.8L16 7" />
        <circle cx="12" cy="13.5" r="3.4" />
      </svg>
    ),
  },
  { id: 'ask', title: 'Ask Atlas', shortTitle: 'Ask Atlas', icon: <AskAtlasIcon /> },
  {
    id: 'leaderboard',
    title: 'Streak leaderboard',
    shortTitle: 'Community',
    icon: (
      <svg {...icon}>
        <path d="M7 4h10v5.5a5 5 0 0 1-10 0V4Z" />
        <path d="M7 6H4.5a2.5 2.5 0 0 0 2.5 3.5M17 6h2.5a2.5 2.5 0 0 1-2.5 3.5" />
        <path d="M12 14.5v3M9 21h6l-.6-3.5H9.6Z" />
      </svg>
    ),
  },
  {
    id: 'account',
    title: 'Account',
    shortTitle: 'Account',
    icon: (
      <svg {...icon}>
        <circle cx="12" cy="8" r="3.6" />
        <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
      </svg>
    ),
  },
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
  // Settings intentionally opens on Location -- it's the setting a new
  // visitor is most likely to want to check or correct first, and it's
  // useful without an account. Every other section is one tap away.
  const [activeSection, setActiveSection] = useState<SettingsSection>('location')
  // Below the settings-layout breakpoint (App.css), the list and the detail
  // pane stack in one column instead of sitting side by side -- tapping a
  // row swapped the detail pane's content in place, off-screen below the
  // fold, with no scroll and no visual change at the tap point, so it read
  // as completely unresponsive even though the state change did happen.
  // This tracks whether to show the detail pane (full width, with a way
  // back) in place of the list on that stacked layout; CSS gates all of it
  // behind the same breakpoint so desktop's side-by-side view is untouched.
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
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
    <div className="page settings-page atlas-settings">
      <h1 className="settings-page-title">Settings</h1>
      <div className="atlas-account-card">
        <span aria-hidden="true">◌</span><div><strong>{user?.email ?? 'Your Atlas account'}</strong><small>{user?.entitled ? 'SKY PASS · ACTIVE' : 'FREE ACCOUNT'}</small></div>
      </div>

      <div className={`settings-layout${mobileDetailOpen ? ' settings-layout--detail-open' : ''}`}>
        <nav className="settings-list" role="tablist" aria-label="Settings sections">
          {SECTION_GROUPS.map((group) => {
            const items = group.ids
              .map((id) => availableSections.find((candidate) => candidate.id === id))
              .filter((item): item is (typeof availableSections)[number] => Boolean(item))
            if (items.length === 0) return null
            return (
              <div className="settings-list-group" key={group.title}>
                <h2>{group.title}</h2>
                <div className="settings-list-items">
                  {items.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      role="tab"
                      aria-selected={section.id === item.id}
                      className={`settings-list-item${section.id === item.id ? ' is-active' : ''}`}
                      onClick={() => {
                        setActiveSection(item.id)
                        setMobileDetailOpen(true)
                      }}
                    >
                      <span className="settings-list-icon">{item.icon}</span>
                      <span className="settings-list-copy">
                        <strong>{item.title}</strong>
                        <small>{item.id === 'location' ? currentLocation.name : item.id === 'appearance' ? 'Dark / light' : item.id === 'devices' ? 'Device & camera' : 'Manage in Atlas'}</small>
                      </span>
                      <span className="settings-list-chevron" aria-hidden="true">›</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </nav>

        <section className={`settings-detail${section.id === 'ask' ? ' settings-detail--ask' : ''}`}>
          <button type="button" className="settings-back-row" onClick={() => setMobileDetailOpen(false)}>
            <span aria-hidden="true">‹</span> Settings
          </button>
          <div className="settings-detail-heading">
            <span className="settings-detail-icon">{section.icon}</span>
            <div>
              <p className="settings-detail-kicker">Settings</p>
              <h2 className="settings-section-title">{section.title}</h2>
            </div>
          </div>
          {contentFor(section.id)}
        </section>
      </div>
    </div>
  )
}

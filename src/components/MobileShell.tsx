import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import '../mobile.css'
import { HubView } from '../views/mobile/HubView'
import { EventsView } from '../views/mobile/EventsView'
import { PlanView } from '../views/mobile/PlanView'
import { JournalView } from '../views/mobile/JournalView'
import { SettingsView } from '../views/SettingsView'
import { signOut, useAuth } from '../lib/auth'
import { applyTheme, getStoredTheme, getSystemTheme, storeTheme } from '../lib/theme'
import { getUpcomingEvents } from '../lib/sync'
import { formatEventDate } from '../lib/eventFormat'
import { addToWatchlist, formatWatchValue, getWatchableTargets, getWatchlist, isWatching, removeFromWatchlist, type WatchlistItem } from '../lib/watchlist'
import { trackEvent } from '../lib/analytics'
import { SignupWallModal } from './SignupWallModal'
import { SignupWelcomeBeat } from './SignupWelcomeBeat'
import { PaywallGate } from './PaywallGate'
import { useSignupWall } from '../lib/useSignupWall'
import type { CurrentLocation } from '../lib/currentLocation'
import type { LocationStatus } from '../lib/geo'
import type { City } from '../lib/cities'
import type { SkyEvent } from '../lib/db'
import type { ObservationDraft } from '../lib/observationDraft'

export type MobileTab = 'hub' | 'events' | 'calendar' | 'journal'

const ROUTES: Array<{ id: MobileTab; label: string; consoleClass: string; icon: ReactElement }> = [
  {
    id: 'hub',
    label: 'Today',
    consoleClass: 'tab-sky',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor">
        <circle cx="10" cy="10" r="7" />
        <path d="M10 3v3M10 14v3M3 10h3M14 10h3" />
      </svg>
    ),
  },
  {
    id: 'events',
    label: 'Events',
    consoleClass: 'tab-events',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor">
        <circle cx="10" cy="10" r="2.2" />
        <path d="M10 2v3M10 15v3M2 10h3M15 10h3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'calendar',
    label: 'Plan',
    consoleClass: 'tab-plan',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor">
        <rect x="3" y="4" width="14" height="13" rx="1.5" />
        <path d="M3 8h14M7 2v4M13 2v4" />
      </svg>
    ),
  },
  {
    id: 'journal',
    label: 'Journal',
    consoleClass: 'tab-journal',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor">
        <path d="M4 3.5h9l3 3v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
        <path d="M7 8.5h6M7 11.5h6M7 5.5h3" />
      </svg>
    ),
  },
]

const SEARCH_ICON = (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor">
    <circle cx="9" cy="9" r="6" />
    <path d="M17 17l-3.5-3.5" strokeLinecap="round" />
  </svg>
)

const TAB_CONTEXT: Record<MobileTab, string> = {
  hub: 'TODAY',
  events: 'SKY EVENTS',
  calendar: 'PLAN',
  journal: 'JOURNAL',
}

// Real, bookmarkable/back-button-able routes per tab (STS: mobile routing).
const TAB_PATH: Record<MobileTab, string> = {
  hub: '/today',
  events: '/events',
  calendar: '/plan',
  journal: '/journal',
}

const PATH_TAB: Record<string, MobileTab> = {
  '/today': 'hub',
  '/events': 'events',
  '/plan': 'calendar',
  '/journal': 'journal',
}

function tabFromPathname(pathname: string): MobileTab {
  return PATH_TAB[pathname] ?? 'hub'
}

interface MobileShellProps {
  currentLocation: CurrentLocation
  locationStatus: LocationStatus
  requestLocation: () => void
  manualCity: City | null
  setManualLocation: (city: City | null) => void
  needsMotionPermission: boolean
  requestMotionPermission: () => void
}

export function MobileShell({
  currentLocation,
  locationStatus,
  requestLocation,
  manualCity,
  setManualLocation,
  needsMotionPermission,
  requestMotionPermission,
}: MobileShellProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const settingsOpen = location.pathname === '/settings'
  const tab = tabFromPathname(location.pathname)
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchStatus, setSearchStatus] = useState('')
  const [searchBlockedPlanAdd, setSearchBlockedPlanAdd] = useState(false)
  const [searchEvents, setSearchEvents] = useState<SkyEvent[]>([])
  const [searchTargets, setSearchTargets] = useState<string[]>([])
  const [searchWatchlist, setSearchWatchlist] = useState<WatchlistItem[]>([])
  const [observationDraft, setObservationDraft] = useState<ObservationDraft | null>(null)
  const [isDark, setIsDark] = useState(() => (getStoredTheme() ?? getSystemTheme()) === 'dark')
  const [welcomeMergedCount, setWelcomeMergedCount] = useState<number | null>(null)
  const { user } = useAuth()
  const signupWall = useSignupWall()
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // Collapses the brand row + location switch (not the tab bar, which stays
  // reachable) once the user scrolls down a bit, giving back vertical space
  // on small screens -- requested via the in-app feedback form (STS-500).
  // `.mobile-content` is the actual scroll container (see mobile.css); the
  // header sits above it as a fixed-height flex sibling rather than
  // scrolling with it, so this has to be driven from JS instead of a pure
  // CSS sticky trick.
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    let lastScrollTop = el.scrollTop
    const THRESHOLD = 8
    const NEAR_TOP = 24
    function onScroll() {
      const top = el!.scrollTop
      const delta = top - lastScrollTop
      if (top <= NEAR_TOP) setHeaderCollapsed(false)
      else if (delta > THRESHOLD) setHeaderCollapsed(true)
      else if (delta < -THRESHOLD) setHeaderCollapsed(false)
      lastScrollTop = top
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [tab, searchOpen])

  useEffect(() => {
    applyTheme(isDark ? 'dark' : 'light')
    storeTheme(isDark ? 'dark' : 'light')
  }, [isDark])

  useEffect(() => {
    if (location.pathname === '/') navigate(TAB_PATH.hub, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only redirect the bare landing path once
  }, [])

  useEffect(() => {
    if (!searchOpen) return
    let cancelled = false
    async function load() {
      const [events, targets, watched] = await Promise.all([getUpcomingEvents(300), getWatchableTargets(), getWatchlist()])
      if (cancelled) return
      setSearchEvents(events)
      setSearchTargets(targets)
      setSearchWatchlist(watched)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [searchOpen])

  async function toggleSearchWatch(target: string) {
    if (!user?.entitled) {
      setSearchBlockedPlanAdd(true)
      setSearchStatus('Sky Pass is required to add targets to a plan. Browsing and check-ins stay free.')
      trackEvent('Blocked free plan add', { action: 'watch', source: 'mobile_search' })
      return
    }
    if (isWatching(searchWatchlist, 'target', target)) {
      await removeFromWatchlist('target', target)
    } else {
      await addToWatchlist('target', target)
      signupWall.promptAfterSave('favourite')
    }
    setSearchWatchlist(await getWatchlist())
  }

  const trimmedSearchQuery = searchQuery.trim().toLocaleLowerCase()
  const matchedSearchEvents = trimmedSearchQuery
    ? searchEvents.filter(
        (event) =>
          event.title.toLocaleLowerCase().includes(trimmedSearchQuery) ||
          event.target.toLocaleLowerCase().includes(trimmedSearchQuery) ||
          event.kind.toLocaleLowerCase().includes(trimmedSearchQuery),
      )
    : []
  const matchedSearchTargets = trimmedSearchQuery
    ? searchTargets.filter((target) => target.toLocaleLowerCase().includes(trimmedSearchQuery))
    : []
  const hasSearchQuery = trimmedSearchQuery.length > 0
  const hasSearchResults = matchedSearchEvents.length > 0 || matchedSearchTargets.length > 0

  function openSearchEvent() {
    setSearchOpen(false)
    goToTab('events')
  }

  function toggleTheme() {
    setIsDark((current) => !current)
  }

  function openSettings() {
    setProfileOpen(false)
    navigate('/settings')
  }

  function goToTab(nextTab: MobileTab) {
    setProfileOpen(false)
    setSearchOpen(false)
    setHeaderCollapsed(false)
    navigate(TAB_PATH[nextTab])
  }

  function logAttempt(draft: ObservationDraft) {
    setObservationDraft(draft)
    setProfileOpen(false)
    navigate(TAB_PATH.journal)
  }

  const locationLabel = `${currentLocation.name.toUpperCase()} · ${TAB_CONTEXT[tab]}`
  const accountLabel = user?.email ?? 'Offline profile'
  const accountInitial = user?.email?.[0]?.toUpperCase() ?? 'A'

  if (settingsOpen) {
    return (
      <div className="mobile-shell dt-settings-panel">
        <header className="mobile-header dt-settings-header">
          <button type="button" className="dt-settings-back" onClick={() => navigate(-1)} aria-label="Back to Atlas">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M12.5 4.5 7 10l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="dt-settings-heading">
            <span className="dt-settings-title">Settings</span>
            <span className="dt-settings-subtitle">{locationLabel}</span>
          </div>
          <div className="mobile-profile-avatar" aria-hidden="true">
            {accountInitial}
          </div>
        </header>
        <div className="mobile-content">
          <SettingsView
            locationStatus={locationStatus}
            requestLocation={requestLocation}
            currentLocation={currentLocation}
            manualCity={manualCity}
            setManualLocation={setManualLocation}
            needsMotionPermission={needsMotionPermission}
            requestMotionPermission={requestMotionPermission}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-shell">
      <header className={headerCollapsed ? 'dt-header-collapsed' : ''}>
        <div className="dt-brand-row">
          <button type="button" className="dt-brand-btn" onClick={() => goToTab('hub')} aria-label="Open Atlas sky hub">
            <span className="dt-brand-lockup">
              <img src="/atlas-icon.png" alt="" className="dt-brand-mark" />
              <span className="dt-wordmark">ATLAS</span>
            </span>
            <span className="dt-brand-subtitle">Field console</span>
          </button>
          <div className="dt-avatar-wrap">
            <button
              type="button"
              className="dt-avatar"
              onClick={() => setProfileOpen((current) => !current)}
              aria-label="Open profile menu"
              aria-expanded={profileOpen}
            >
              {accountInitial}
            </button>
            {profileOpen && (
              <div className="dt-profile-menu">
                <div className="dt-profile-menu-head">
                  <span>Profile</span>
                  <strong>{accountLabel}</strong>
                </div>
                <button type="button" onClick={openSettings}>
                  Account & settings
                </button>
                <button type="button" onClick={toggleTheme}>
                  {isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                </button>
                {user && (
                  <button type="button" onClick={signOut}>
                    Sign out
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          className="dt-location-switch"
          onClick={() => {
            trackEvent('Location switch opened', { source: 'mobile_header', location: currentLocation.name })
            openSettings()
          }}
          aria-label={`Change location. Currently ${currentLocation.name}`}
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true">
            <path d="M10 18s6-5.1 6-10A6 6 0 0 0 4 8c0 4.9 6 10 6 10Z" />
            <circle cx="10" cy="8" r="2" />
          </svg>
          <span>{currentLocation.name}</span>
          <small>Change</small>
        </button>
        <nav className="dt-tabbar" aria-label="Primary">
          {ROUTES.map((route) => (
            <button
              type="button"
              key={route.id}
              className={`dt-tab${!searchOpen && tab === route.id ? ' is-active' : ''}`}
              onClick={() => goToTab(route.id)}
              aria-current={!searchOpen && tab === route.id ? 'page' : undefined}
            >
              {route.icon}
              <span>{route.label}</span>
            </button>
          ))}
          <button
            type="button"
            className={`dt-tab${searchOpen ? ' is-active' : ''}`}
            onClick={() => {
              setProfileOpen(false)
              setSearchStatus('')
              setSearchBlockedPlanAdd(false)
              setSearchOpen((current) => !current)
            }}
            aria-current={searchOpen ? 'page' : undefined}
          >
            {SEARCH_ICON}
            <span>Search</span>
          </button>
        </nav>
      </header>

      <div className="mobile-content" ref={contentRef}>
        {signupWall.reason && (
          <SignupWallModal
            reason={signupWall.reason}
            onDismiss={signupWall.dismiss}
            onSignedUp={(mergedCount) => {
              signupWall.complete()
              setWelcomeMergedCount(mergedCount)
            }}
          />
        )}
        {welcomeMergedCount != null && (
          <SignupWelcomeBeat mergedCount={welcomeMergedCount} onDone={() => setWelcomeMergedCount(null)} />
        )}
        {searchOpen ? (
          <div className="dt-search-panel">
            <div className="dt-section-eyebrow">Search</div>
            <div className="dt-search-input-row">
              {SEARCH_ICON}
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => {
                  setSearchStatus('')
                  setSearchBlockedPlanAdd(false)
                  setSearchQuery(event.target.value)
                }}
                placeholder="Search events, targets, catalog IDs…"
                autoFocus
              />
            </div>
            {searchStatus && <p className="planner-reminder-status">{searchStatus}</p>}
            {searchBlockedPlanAdd && (
              <PaywallGate
                user={user}
                feature="Add to plan"
                description="Saving targets, reminders, and holiday planning are part of the Sky Pass."
                freeNote="You can keep browsing local events and checking in for free."
                onSignInClick={openSettings}
              >
                {null}
              </PaywallGate>
            )}
            {!hasSearchQuery && (
              <p className="dt-empty-hint">Start typing to search tonight&rsquo;s events, the watchlist, and the catalog.</p>
            )}
            {hasSearchQuery && !hasSearchResults && (
              <p className="dt-empty-hint">No matches for &ldquo;{searchQuery.trim()}&rdquo;. Try a target name like &ldquo;Jupiter&rdquo; or an event type like &ldquo;meteor&rdquo;.</p>
            )}
            {matchedSearchTargets.length > 0 && (
              <>
                <div className="dt-section-eyebrow">Targets</div>
                <ul className="dt-search-results">
                  {matchedSearchTargets.map((target) => (
                    <li key={target} className="dt-search-result-row">
                      <span>{formatWatchValue(target)}</span>
                      <button type="button" onClick={() => toggleSearchWatch(target)}>
                        {isWatching(searchWatchlist, 'target', target) ? 'Watching' : 'Watch'}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {matchedSearchEvents.length > 0 && (
              <>
                <div className="dt-section-eyebrow">Events</div>
                <ul className="dt-search-results">
                  {matchedSearchEvents.map((event) => (
                    <li key={event.id} className="dt-search-result-row">
                      <button type="button" className="dt-search-result-event" onClick={openSearchEvent}>
                        <span>{event.title}</span>
                        <small>{formatEventDate(event.startsAt)}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : (
          <>
            {tab === 'hub' && <HubView city={currentLocation} onOpenTab={goToTab} onLogAttempt={logAttempt} />}
            {tab === 'events' && <EventsView city={currentLocation} onLogAttempt={logAttempt} onSavedForLater={() => signupWall.promptAfterSave('favourite')} />}
            {tab === 'calendar' && (
              <PlanView
                city={currentLocation}
                onOpenEvents={() => goToTab('events')}
                onLogAttempt={logAttempt}
                onSavedForLater={() => signupWall.promptAfterSave('favourite')}
              />
            )}
            {tab === 'journal' && <JournalView draft={observationDraft} onDraftConsumed={() => setObservationDraft(null)} />}
          </>
        )}
      </div>
    </div>
  )
}

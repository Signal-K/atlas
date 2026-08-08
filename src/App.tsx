import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LandingPage } from './views/LandingPage'
import { AppShell } from './AppShell'
import { AuthForm } from './components/AuthForm'
import { Starfield } from './components/Starfield'
import { useAuth } from './lib/auth'
import { useIsMobile } from './lib/useIsMobile'
import { useEntitlementSync } from './providers/useEntitlementSync'
import { useThemeBootstrap } from './providers/useThemeBootstrap'
import './App.css'

const APP_HOME = '/app/events'

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, entitlementRefreshing } = useAuth()
  const isMobile = useIsMobile()
  const isAppRoute = location.pathname.startsWith('/app')
  const showLanding = !isAppRoute

  useThemeBootstrap()
  useEntitlementSync()

  // Bare "/app" has no view of its own -- send it to the default tab.
  useEffect(() => {
    if (location.pathname === '/app') navigate(APP_HOME, { replace: true })
  }, [location.pathname, navigate])

  if (showLanding) {
    return (
      <>
        <Starfield />
        <LandingPage authenticatedEmail={user?.email} isMobile={isMobile} onEnter={() => navigate(APP_HOME)} />
      </>
    )
  }

  if (!user) {
    return (
      <>
        <Starfield />
        <div className="app-placeholder">
          <div className="app-placeholder-card">
            <h1>Sign in to Atlas</h1>
            <AuthForm source="app-gate" />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Starfield />
      <AppShell user={user} entitlementRefreshing={entitlementRefreshing} />
    </>
  )
}

export default App

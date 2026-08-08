import { useLocation, useNavigate } from 'react-router-dom'
import { LandingPage } from './views/LandingPage'
import { AuthForm } from './components/AuthForm'
import { useAuth, signOut } from './lib/auth'
import { useIsMobile } from './lib/useIsMobile'
import './App.css'

// Everything past sign-in was torn out for a full rebuild (KES-131) -- this
// placeholder is deliberately minimal, not a stand-in for a real app shell.
function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const showLanding = location.pathname !== '/app'

  if (showLanding) {
    return <LandingPage authenticatedEmail={user?.email} isMobile={isMobile} onEnter={() => navigate('/app')} />
  }

  return (
    <div className="app-placeholder">
      <div className="app-placeholder-card">
        {user ? (
          <>
            <h1>You're signed in</h1>
            <p>{user.email}</p>
            <button type="button" className="ui-button" onClick={() => signOut()}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <h1>Sign in to Atlas</h1>
            <AuthForm source="app-gate" />
          </>
        )}
      </div>
    </div>
  )
}

export default App

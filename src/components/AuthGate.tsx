import { AuthForm } from './AuthForm'

interface AuthGateProps {
  defaultMode: 'sign-in' | 'sign-up'
}

// Blocking, full-screen gate shown right after "Get started" -- nothing
// past this (onboarding, the app shell) renders until useAuth()'s `user`
// is set. Reuses the onboarding overlay's own styling for visual
// continuity with the step that follows it.
export function AuthGate({ defaultMode }: AuthGateProps) {
  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal auth-gate-modal">
        <h2>{defaultMode === 'sign-up' ? 'Create your free account' : 'Sign in to continue'}</h2>
        <p>Save your sky-watching plans and sync them across devices — takes a few seconds.</p>
        <AuthForm defaultMode={defaultMode} source="auth_gate" />
      </div>
    </div>
  )
}

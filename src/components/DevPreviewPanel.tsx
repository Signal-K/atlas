import { getDevPreviewUser, setDevPreviewUser, useAuth, type AuthUser } from '../lib/auth'
import { ONBOARDING_VERSION } from '../lib/onboarding'

// Local visual-QA helper only -- lets a local dev session preview signed-in
// (and Sky Pass on/off) states without creating a real account. Rendered
// only when import.meta.env.DEV is true, which Vite replaces with a
// literal `false` in production builds, so this is dead-code-eliminated
// out of anything actually shipped.
const DEV_USER: AuthUser = {
  id: 'dev-preview-user',
  email: 'dev-preview@local.test',
  entitled: false,
  onboarded: true,
  // Stamped at the current version so previewing the signed-in state shows the
  // app rather than dropping the 8-step first-run flow over it. Clear
  // localStorage instead when the flow itself is what you want to look at.
  onboardingVersion: ONBOARDING_VERSION,
  deviceModels: [],
  firstTourCompletedAt: null,
  firstTourBadge: null,
}

export function DevPreviewPanel() {
  const { user } = useAuth()
  if (!import.meta.env.DEV) return null
  const previewing = Boolean(getDevPreviewUser())

  return (
    <div
      className="dev-preview-panel"
    >
      <span>DEV PREVIEW</span>
      {!previewing ? (
        <button type="button" onClick={() => setDevPreviewUser(DEV_USER)}>
          Preview signed-in
        </button>
      ) : (
        <>
          <button type="button" onClick={() => setDevPreviewUser({ ...DEV_USER, entitled: !user?.entitled })}>
            Sky Pass: {user?.entitled ? 'ON' : 'OFF'} (toggle)
          </button>
          <button type="button" onClick={() => setDevPreviewUser(null)}>
            Exit preview
          </button>
        </>
      )}
    </div>
  )
}

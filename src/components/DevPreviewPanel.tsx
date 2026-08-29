import { getDevPreviewUser, setDevPreviewUser, useAuth, type AuthUser } from '../lib/auth'

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
  deviceModels: [],
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

import { isPreviewDeployment, setFreeOverride, useFreeOverride } from '../lib/previewMode'

// Preview-deployment-only: lets whoever's reviewing a build flip the app
// into the free tier in their own browser, without needing a second,
// un-entitled account. Never renders on the production domain.
export function PreviewFreeToggle() {
  const enabled = useFreeOverride()
  if (!isPreviewDeployment()) return null

  return (
    <section className="ui-section">
      <h2 className="ui-section-title">Preview: simulate free tier</h2>
      <label className="settings-toggle-row">
        <input type="checkbox" checked={enabled} onChange={(event) => setFreeOverride(event.target.checked)} />
        <span>View Atlas as a free (non-Sky Pass) account in this browser</span>
      </label>
      <p className="settings-help">Only visible on preview deployments. Doesn't change your real Sky Pass entitlement.</p>
    </section>
  )
}

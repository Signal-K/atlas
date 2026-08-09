// Preview deployments (Cloudflare Pages: `<hash>.<project>.pages.dev`, as
// opposed to the production custom domain) get a browser-only toggle on the
// Account page to preview the free tier without needing a second,
// un-entitled account. Purely cosmetic -- it never touches the server-side
// `entitled` flag, only what the UI renders it as.
import { useEffect, useState } from 'react'

const FREE_OVERRIDE_KEY = 'atlas:previewFreeOverride'
const listeners = new Set<() => void>()

export function isPreviewDeployment(): boolean {
  return window.location.hostname.endsWith('.pages.dev')
}

export function isFreeOverrideEnabled(): boolean {
  return isPreviewDeployment() && localStorage.getItem(FREE_OVERRIDE_KEY) === '1'
}

export function setFreeOverride(enabled: boolean): void {
  if (!isPreviewDeployment()) return
  if (enabled) localStorage.setItem(FREE_OVERRIDE_KEY, '1')
  else localStorage.removeItem(FREE_OVERRIDE_KEY)
  listeners.forEach((listener) => listener())
}

// Applies the preview-only free override on top of the real entitlement, so
// every call site that gates on `entitled` sees the overridden value without
// having to know the override exists.
export function effectiveEntitled(entitled: boolean): boolean {
  return entitled && !isFreeOverrideEnabled()
}

// Re-renders the caller when the toggle changes, e.g. flipping it on the
// Account page while the Events/Conditions tab is still mounted.
export function useFreeOverride(): boolean {
  const [enabled, setEnabled] = useState(isFreeOverrideEnabled())
  useEffect(() => {
    const listener = () => setEnabled(isFreeOverrideEnabled())
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])
  return enabled
}

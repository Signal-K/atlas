// Local-only "no backend" mode: lets the frontend run against Dexie/cached
// and fixture data without a running PocketBase (e.g. Docker not started).
//
// Safety: gated on `import.meta.env.DEV`, which Vite hardcodes to `false` for
// every `vite build` output regardless of --mode (production, staging, ...).
// Bundlers dead-code-eliminate the `false &&` branch, so the localStorage
// check -- and this entire module's effect -- cannot run in a built app; it
// only exists when running `vite dev` locally.
const DEMO_MODE_KEY = 'atlas:demoMode'

// True when VITE_DEMO_MODE=1 forced it on for this dev server process (e.g.
// `make demo`) — the Diagnostics checkbox can't override that until restart.
export function isDemoModeForcedByEnv(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === '1'
}

export function isDemoMode(): boolean {
  if (!import.meta.env.DEV) return false
  // VITE_DEMO_MODE lets `make demo` start dev mode pre-enabled without
  // touching the browser toggle; the localStorage flag still lets it be
  // switched on/off at runtime from Diagnostics.
  return import.meta.env.VITE_DEMO_MODE === '1' || localStorage.getItem(DEMO_MODE_KEY) === '1'
}

export function setDemoMode(enabled: boolean): void {
  if (!import.meta.env.DEV) return
  if (enabled) localStorage.setItem(DEMO_MODE_KEY, '1')
  else localStorage.removeItem(DEMO_MODE_KEY)
}

// Only the stable staging host emits authentication diagnostics.
export function authDebug(stage, error, details = {}, sensitive = []) {
  if (typeof window === 'undefined' || window.location.hostname !== 'staging.atlas-4xz.pages.dev') return
  const clean = value => {
    if (typeof value !== 'string') return undefined
    let text = value.slice(0, 2000)
    for (const secret of sensitive) if (secret) text = text.split(secret).join('[redacted]')
    return text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[token]')
  }
  const item = error && typeof error === 'object' ? error : {}
  const safeError = entry => ({
    code: clean(entry?.code), message: clean(entry?.message), longMessage: clean(entry?.longMessage),
  })
  const diagnostic = {
    stage, timestamp: new Date().toISOString(), path: window.location.pathname,
    status: details.status, statusText: clean(details.statusText),
    name: clean(item.name), ...safeError(item),
    errors: Array.isArray(item.errors) ? item.errors.map(safeError) : undefined,
  }
  console.groupCollapsed(`[Auth debug] ${stage}`)
  console.error('Authentication failure', diagnostic)
  console.groupEnd()
}

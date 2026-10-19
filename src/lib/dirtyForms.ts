import { useEffect } from 'react'

const dirtyForms = new Set<string>()
let bridgeStarted = false

function postDirtyState() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.controller?.postMessage({
    type: 'atlas:dirty-forms',
    dirty: dirtyForms.size > 0,
  })
}

export function startDirtyFormBridge() {
  if (bridgeStarted || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  bridgeStarted = true

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // A new worker takes over after activation; re-send the current state so it
    // can make an update decision without forcing this tab to reload.
    window.setTimeout(postDirtyState, 0)
  })

  window.addEventListener('beforeunload', () => {
    dirtyForms.clear()
    postDirtyState()
  })
}

function setDirty(formId: string, dirty: boolean) {
  if (dirty) dirtyForms.add(formId)
  else dirtyForms.delete(formId)
  postDirtyState()
}

export function useDirtyFormRegistration(formId: string, dirty: boolean) {
  useEffect(() => {
    setDirty(formId, dirty)
    return () => setDirty(formId, false)
  }, [formId, dirty])
}

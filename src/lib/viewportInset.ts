let started = false
let rafId = 0
let lastEditableFocusAt = 0

function isEditableElement(value: unknown): value is HTMLElement {
  const el = value as HTMLElement | null
  if (!el) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
}

function hasEditableFocus(): boolean {
  return isEditableElement(document.activeElement)
}

export function startViewportInsetTracking() {
  if (started) return
  started = true

  const viewport = window.visualViewport
  const root = document.documentElement

  function updateNow() {
    if (!viewport) {
      root.style.setProperty('--az-keyboard-inset', '0px')
      return
    }

    const keyboardInset = hasEditableFocus() || Date.now() - lastEditableFocusAt < 1_200
      ? Math.max(0, window.innerHeight - (viewport.height + viewport.offsetTop))
      : 0
    root.style.setProperty('--az-keyboard-inset', `${Math.round(keyboardInset)}px`)
  }

  function requestUpdate() {
    if (rafId !== 0) return
    rafId = window.requestAnimationFrame(() => {
      rafId = 0
      updateNow()
    })
  }

  viewport?.addEventListener('resize', requestUpdate)
  viewport?.addEventListener('scroll', requestUpdate)
  window.addEventListener('resize', requestUpdate)
  window.addEventListener('orientationchange', requestUpdate)
  document.addEventListener('focusin', (event) => {
    if (isEditableElement(event.target)) lastEditableFocusAt = Date.now()
    requestUpdate()
  })
  document.addEventListener('focusout', requestUpdate)
  requestUpdate()
}

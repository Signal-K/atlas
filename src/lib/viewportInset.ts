// On iOS/Android, the on-screen keyboard shrinks the *visual* viewport
// while the *layout* viewport -- what `position: fixed` and svh/dvh units
// are computed against -- stays full height. A bottom-pinned panel holding
// a text input (the itinerary builder sheet, the feedback dock) can sit
// behind the keyboard while it's up, then visibly snap back into place the
// instant focus moves to a button and the keyboard dismisses. Tracking the
// gap between the two viewports and exposing it as a CSS variable lets
// those panels track the visible viewport continuously instead of snapping.
//
// window.innerHeight and visualViewport.height are NOT reliably equal
// whenever no keyboard is up -- browser/PWA chrome (toolbars, safe areas)
// can shift either one independently of any keyboard, and a plain
// window.scrollTo() is enough to fire a visualViewport resize/scroll event
// that recomputes this gap. Gate the calculation on an actual focused text
// input so route changes and ordinary scrolling can never produce a false
// "keyboard" offset that shoves a fixed panel off the bottom edge.
let started = false

function hasEditableFocus(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
}

export function startViewportInsetTracking() {
  if (started) return
  started = true

  const viewport = window.visualViewport
  if (!viewport) return

  const root = document.documentElement

  function update() {
    if (!hasEditableFocus()) {
      root.style.setProperty('--az-keyboard-inset', '0px')
      return
    }
    const inset = Math.max(0, window.innerHeight - viewport!.height - viewport!.offsetTop)
    root.style.setProperty('--az-keyboard-inset', `${inset}px`)
  }

  viewport.addEventListener('resize', update)
  viewport.addEventListener('scroll', update)
  document.addEventListener('focusin', update)
  document.addEventListener('focusout', update)
  update()
}

// On iOS/Android, the on-screen keyboard shrinks the *visual* viewport
// while the *layout* viewport -- what `position: fixed` and svh/dvh units
// are computed against -- stays full height. Anything pinned to the bottom
// of the layout viewport (the itinerary builder sheet, the feedback dock,
// the mobile tab bar) that also holds a text input therefore sits behind
// the keyboard while it's up, then visibly snaps back into place the
// instant focus moves to a button and the keyboard dismisses -- the "whole
// screen jumps" effect. Tracking the gap between the two viewports
// ourselves and exposing it as a CSS variable lets those panels track the
// visible viewport continuously instead of snapping.
let started = false

export function startViewportInsetTracking() {
  if (started) return
  started = true

  const viewport = window.visualViewport
  if (!viewport) return

  const root = document.documentElement

  function update() {
    const inset = Math.max(0, window.innerHeight - viewport!.height - viewport!.offsetTop)
    root.style.setProperty('--az-keyboard-inset', `${inset}px`)
  }

  viewport.addEventListener('resize', update)
  viewport.addEventListener('scroll', update)
  update()
}

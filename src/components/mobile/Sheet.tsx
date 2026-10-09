import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MobileIcon } from './MobileIcon'

// Bottom sheet, matching the Atlas Mobile mockup's `hasSheet` chrome:
// backdrop + rounded-top slide-up panel with a title row and a scrollable
// body. Used across Profile, Planner, Journal, and the Event Detail
// overlay for every "quick pick" surface (location, instruments, camera
// recipe, capture, entry detail, challenge, itinerary builder, paywall).
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  const sheetRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open || !sheetRef.current) return
    const focusedTargets = new WeakSet<HTMLElement>()
    const host = sheetRef.current
    let lastEditableTarget: HTMLElement | null = null
    let resizeTimer = 0

    function activeEditableTarget(target: EventTarget | null): HTMLElement | null {
      const node = target as HTMLElement | null
      if (!node) return null
      if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName) && !node.isContentEditable) return null
      return node
    }

    function scrollIntoViewOnce(target: HTMLElement | null) {
      if (!target || focusedTargets.has(target)) return
      focusedTargets.add(target)
      window.requestAnimationFrame(() => {
        target.scrollIntoView({ block: 'center', inline: 'nearest' })
        window.requestAnimationFrame(() => {
          const viewportTop = window.visualViewport?.offsetTop ?? 0
          const viewportBottom = viewportTop + (window.visualViewport?.height ?? window.innerHeight)
          const margin = 12
          const rect = target.getBoundingClientRect()
          const upperBound = viewportTop + margin
          const lowerBound = viewportBottom - margin
          const sheetBody = target.closest('.az-sheet-body') as HTMLElement | null
          if (!sheetBody) return

          if (rect.bottom > lowerBound) {
            sheetBody.scrollTop += rect.bottom - lowerBound
          } else if (rect.top < upperBound) {
            sheetBody.scrollTop -= upperBound - rect.top
          }
        })
      })
    }

    function keepFocusedControlInView(event: Event) {
      const target = activeEditableTarget(event.target)
      if (!target) return
      lastEditableTarget = target
      scrollIntoViewOnce(target)
    }

    function keepFocusedControlInViewAfterViewportSettles() {
      if (resizeTimer !== 0) window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        resizeTimer = 0
        const active = activeEditableTarget(document.activeElement)
        const target =
          active && host.contains(active)
            ? active
            : lastEditableTarget && host.contains(lastEditableTarget)
              ? lastEditableTarget
              : null
        if (!target) return
        focusedTargets.delete(target)
        scrollIntoViewOnce(target)
      }, 130)
    }

    host.addEventListener('focusin', keepFocusedControlInView)
    window.visualViewport?.addEventListener('resize', keepFocusedControlInViewAfterViewportSettles)
    window.addEventListener('resize', keepFocusedControlInViewAfterViewportSettles)
    return () => {
      host.removeEventListener('focusin', keepFocusedControlInView)
      window.visualViewport?.removeEventListener('resize', keepFocusedControlInViewAfterViewportSettles)
      window.removeEventListener('resize', keepFocusedControlInViewAfterViewportSettles)
      if (resizeTimer !== 0) window.clearTimeout(resizeTimer)
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <>
      <div className="az-sheet-backdrop" onClick={onClose} />
      <div ref={sheetRef} className="az-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="az-sheet-header">
          <strong>{title}</strong>
          <button type="button" className="az-icon-btn" aria-label="Close" onClick={onClose}>
            <MobileIcon name="close" size={15} />
          </button>
        </div>
        <div className="az-sheet-body">{children}</div>
      </div>
    </>,
    document.body,
  )
}

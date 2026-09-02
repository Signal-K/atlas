import { useEffect } from 'react'
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
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <>
      <div className="az-sheet-backdrop" onClick={onClose} />
      <div className="az-sheet" role="dialog" aria-modal="true" aria-label={title}>
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

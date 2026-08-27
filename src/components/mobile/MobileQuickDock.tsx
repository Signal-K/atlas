import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { NavLink, useLocation } from 'react-router-dom'
import type { NavItem } from '../../ui/NavShell'
import { useMobileDetailNav } from '../../lib/mobileDetailNav'
import { useAuth } from '../../lib/auth'
import { getDisplayName } from '../../lib/displayName'

interface MobileQuickDockProps {
  items: NavItem[]
}

export function MobileQuickDock({ items }: MobileQuickDockProps) {
  const [open, setOpen] = useState(false)
  const { active: detailActive } = useMobileDetailNav()
  const { user } = useAuth()
  const location = useLocation()
  const dragRef = useRef<HTMLDivElement>(null)

  useEffect(() => setOpen(false), [location.pathname])

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  const displayName = getDisplayName()

  return (
    <>
      {!detailActive && (
        <motion.button
          type="button"
          className="mobile-menu-trigger"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="mobile-navigation-panel"
          onClick={() => setOpen((current) => !current)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <span aria-hidden="true" className="mobile-menu-trigger-lines">
            <i />
            <i />
            <i />
          </span>
        </motion.button>
      )}
      {open && !detailActive && (
          <motion.div
            className="mobile-menu-layer"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            ref={dragRef}
          >
            <motion.button
              type="button"
              className="mobile-menu-backdrop"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            />
            <motion.aside
              id="mobile-navigation-panel"
              className="mobile-menu-panel"
              aria-label="Mobile menu"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 120 }}
              drag="x"
              dragConstraints={{ right: 0, left: -320 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.velocity.x < -500 || info.offset.x < -80) {
                  setOpen(false)
                }
              }}
            >
              <div className="mobile-menu-panel-head">
                <div className="mobile-menu-profile">
                  {displayName && <span className="mobile-menu-greeting">Hi, {displayName}!</span>}
                  {user && user.entitled && <span className="mobile-menu-tier">Sky Pass</span>}
                </div>
                <motion.button
                  type="button"
                  className="mobile-menu-close"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  whileHover={{ rotate: 90 }}
                >
                  ×
                </motion.button>
              </div>
              <nav className="mobile-menu-links" aria-label="Primary">
                {items.map((item) => (
                  <NavLink key={item.path} to={item.path} onClick={() => setOpen(false)}>
                    <span aria-hidden="true">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </nav>
              <motion.button
                type="button"
                className="mobile-menu-request"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('atlas:open-feature-request'))
                  setOpen(false)
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span aria-hidden="true">+</span>
                Request a feature
              </motion.button>
            </motion.aside>
          </motion.div>
      )}
    </>
  )
}

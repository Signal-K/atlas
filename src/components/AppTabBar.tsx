import { NavLink } from 'react-router-dom'
import type { NavItem } from '../ui/NavShell'

// The persistent mobile bottom nav. Always mounted, always visible -- it
// used to unmount itself whenever a full-screen event-detail overlay was
// open (see git history / mobileDetailNav), which is what caused the
// bar to visibly flicker/disappear on every tap into an event. That hiding
// was also unnecessary: the overlay (.dt-entry, z-index 90) already fully
// covers this bar (z-index 20) on its own, so removing the DOM node bought
// nothing but a mount/unmount flash. Never make this bar conditional again.
//
// In the installed/Home Screen PWA (standalone display-mode), WKWebView can
// briefly reserve space at the bottom of the screen the instant focus lands
// on ANY focusable element -- not just a text input -- as if a keyboard
// might appear, then retract it a beat later once nothing does. No keyboard
// ever shows, but the reserve-then-release still paints as a white gap
// opening under this bar and snapping shut on its own. Blurring the tab
// link the moment it's activated means it never sits focused long enough
// for that reservation to kick in.
function blurOnActivate(event: { currentTarget: HTMLElement }) {
  event.currentTarget.blur()
}

export function AppTabBar({ items }: { items: NavItem[] }) {
  return (
    <nav className="atlas-tab-bar az-tabbar" aria-label="Primary">
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) => `atlas-tab az-tab${isActive ? ' is-active' : ''}`}
          onClick={blurOnActivate}
        >
          <span aria-hidden="true">{item.icon}</span>
          <small>{item.label}</small>
        </NavLink>
      ))}
    </nav>
  )
}

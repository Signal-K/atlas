import { NavLink } from 'react-router-dom'
import type { NavItem } from '../ui/NavShell'

export function AppTabBar({ items }: { items: NavItem[] }) {
  return <nav className="atlas-tab-bar" aria-label="Primary">{items.map((item) => <NavLink key={item.path} to={item.path} className={({ isActive }) => `atlas-tab${isActive ? ' is-active' : ''}`}><span aria-hidden="true">{item.icon}</span><small>{item.path.endsWith('/events') ? 'Tonight' : item.label}</small></NavLink>)}</nav>
}

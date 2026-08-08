import type { ReactNode } from 'react'
import { Card } from '../ui/Card'

interface PlaceholderPageProps {
  title: string
  description: string
  children?: ReactNode
}

// Temporary stand-in for an area that hasn't been rebuilt yet. Each of
// these gets replaced with real content in its own phase (see KES-131);
// this exists so the new shell/routes are fully wired and demoable in the
// meantime rather than left half-built.
export function PlaceholderPage({ title, description, children }: PlaceholderPageProps) {
  return (
    <div className="page">
      <header className="page-header">
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <Card>{children ?? <p style={{ color: 'var(--color-text-muted)' }}>Coming soon.</p>}</Card>
    </div>
  )
}

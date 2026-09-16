import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export function Avatar({ name, size = 'lg' }: { name: string; size?: 'lg' }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
  return <span className={cx('ak-avatar', `ak-avatar--${size}`)}>{initials}</span>
}

export function Badge({
  tone = 'neutral',
  dot,
  children,
}: {
  tone?: 'violet' | 'teal' | 'amber' | 'green' | 'neutral'
  dot?: boolean
  children: ReactNode
}) {
  return <span className={cx('ak-badge', `ak-badge--${tone}`, dot && 'ak-badge--dot')}>{children}</span>
}

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'accent' }) {
  return <button type="button" className={cx('ak-btn', `ak-btn--${variant}`, className)} {...props} />
}

export function Tabs({
  items,
  active,
  onChange,
}: {
  items: Array<{ key: string; label: string }>
  active: string
  onChange: (key: string) => void
}) {
  return (
    <div className="ak-tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          className="ak-tab"
          data-active={item.key === active}
          aria-selected={item.key === active}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function TextField(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="ak-field">
      <input className="ak-input" {...props} />
    </div>
  )
}

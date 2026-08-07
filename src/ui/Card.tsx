import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  raised?: boolean
}

export function Card({ raised, className, ...props }: CardProps) {
  const classes = ['ui-card', raised ? 'ui-card-raised' : '', className].filter(Boolean).join(' ')
  return <div className={classes} {...props} />
}

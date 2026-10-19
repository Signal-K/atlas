import type { ReactNode } from 'react'

type FormStatusTone = 'neutral' | 'error' | 'positive'

interface FormStatusProps {
  message?: string | null
  tone?: FormStatusTone
  action?: ReactNode
  live?: 'polite' | 'assertive'
}

export function FormStatus({ message, tone = 'neutral', action, live = 'polite' }: FormStatusProps) {
  const hasMessage = Boolean(message)
  return (
    <div className={`az-form-status-slot az-form-status-slot--${tone}`}>
      <p
        className={`az-form-status${hasMessage ? ' has-message' : ''}`}
        aria-live={live}
        aria-atomic="true"
        role={tone === 'error' && hasMessage ? 'alert' : undefined}
      >
        {hasMessage ? message : <span aria-hidden="true">&nbsp;</span>}
      </p>
      {action ? <div className="az-form-status-action">{action}</div> : null}
    </div>
  )
}

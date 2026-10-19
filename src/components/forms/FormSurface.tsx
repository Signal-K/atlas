import type { FormEventHandler, ReactNode } from 'react'

interface FormSurfaceProps {
  as?: 'form' | 'div'
  onSubmit?: FormEventHandler<HTMLFormElement>
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function FormSurface({ as = 'form', onSubmit, children, footer, className = '' }: FormSurfaceProps) {
  if (as === 'div') {
    return (
      <div className={`az-form-surface ${className}`.trim()}>
        <div className="az-form-surface-body">{children}</div>
        {footer ? <div className="az-form-surface-footer">{footer}</div> : null}
      </div>
    )
  }

  return (
    <form className={`az-form-surface ${className}`.trim()} onSubmit={onSubmit}>
      <div className="az-form-surface-body">{children}</div>
      {footer ? <div className="az-form-surface-footer">{footer}</div> : null}
    </form>
  )
}

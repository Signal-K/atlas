import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode
}

export function Input({ label, id, className, ...props }: InputProps) {
  const input = <input id={id} className={['ui-input', className].filter(Boolean).join(' ')} {...props} />
  if (!label) return input
  return (
    <label className="ui-field" htmlFor={id}>
      <span className="ui-field-label">{label}</span>
      {input}
    </label>
  )
}

export function FieldLabel(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className="ui-field-label" {...props} />
}

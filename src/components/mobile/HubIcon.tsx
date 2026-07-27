export type HubIconName = 'target' | 'cloud' | 'moon' | 'clock' | 'sun' | 'spark' | 'eye' | 'bell' | 'chevron'

export function HubIcon({ name }: { name: HubIconName }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (name === 'target') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="7" />
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    )
  }
  if (name === 'cloud') {
    return (
      <svg {...common}>
        <path d="M7 18h10a4 4 0 0 0 .4-8 6 6 0 0 0-11.2 1.7A3.2 3.2 0 0 0 7 18Z" />
      </svg>
    )
  }
  if (name === 'moon') {
    return (
      <svg {...common}>
        <path d="M18.5 15.5A7 7 0 0 1 8.5 5.5 8 8 0 1 0 18.5 15.5Z" />
      </svg>
    )
  }
  if (name === 'clock') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v5l3 2" />
      </svg>
    )
  }
  if (name === 'sun') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2.5v2M12 19.5v2M4.8 4.8l1.4 1.4M17.8 17.8l1.4 1.4M2.5 12h2M19.5 12h2M4.8 19.2l1.4-1.4M17.8 6.2l1.4-1.4" />
      </svg>
    )
  }
  if (name === 'eye') {
    return (
      <svg {...common}>
        <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    )
  }
  if (name === 'bell') {
    return (
      <svg {...common}>
        <path d="M7 10a5 5 0 0 1 10 0c0 5 2 6 2 6H5s2-1 2-6Z" />
        <path d="M10 19a2.2 2.2 0 0 0 4 0" />
      </svg>
    )
  }
  if (name === 'chevron') {
    return (
      <svg {...common}>
        <path d="M9 5l7 7-7 7" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M12 3l1.5 5 5 .5-4 3.1 1.2 5-3.7-2.6-3.7 2.6 1.2-5-4-3.1 5-.5L12 3Z" />
    </svg>
  )
}

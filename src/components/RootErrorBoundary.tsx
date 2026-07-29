import { Component, type ErrorInfo, type ReactNode } from 'react'

declare global {
  interface Window {
    __atlasRecover?: (clearPrecache?: boolean) => void
  }
}

interface RootErrorBoundaryProps {
  children: ReactNode
}

interface RootErrorBoundaryState {
  error: Error | null
}

const shellStyle = {
  minHeight: '100svh',
  display: 'grid',
  placeItems: 'center',
  padding: '24px',
  background: '#10151d',
  color: '#f1efe7',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  textAlign: 'center' as const,
}

export class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: unknown): RootErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error('Atlas could not finish loading.') }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Atlas root render failed', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main style={shellStyle}>
        <div style={{ maxWidth: 520 }}>
          <img
            src="/atlas-icon.png"
            alt=""
            width={64}
            height={64}
            style={{ borderRadius: '50%', marginBottom: 20 }}
          />
          <h1
            style={{
              margin: '0 0 14px',
              color: '#f1efe7',
              font: '600 clamp(32px, 7vw, 52px)/1.05 Georgia, serif',
            }}
          >
            Atlas needs a refresh
          </h1>
          <p style={{ maxWidth: 440, margin: '0 auto 26px', color: '#c9c9c1', lineHeight: 1.6 }}>
            The app could not finish loading. This usually means Atlas was updated while the page was open.
          </p>
          <button
            type="button"
            onClick={() => {
              if (window.__atlasRecover) window.__atlasRecover(true)
              else window.location.reload()
            }}
            style={{
              minHeight: 48,
              padding: '0 22px',
              border: 0,
              borderRadius: 999,
              background: '#a8c7cb',
              color: '#172027',
              font: '700 13px system-ui',
              cursor: 'pointer',
            }}
          >
            Reload latest version
          </button>
        </div>
      </main>
    )
  }
}

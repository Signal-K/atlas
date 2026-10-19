import { Component, type ErrorInfo, type ReactNode } from 'react'
import { trackEvent } from '../lib/analytics'

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

export class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: unknown): RootErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error('Atlas could not finish loading.') }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Atlas root render failed', error, info.componentStack)
    // Top-level app crash -- otherwise invisible to analytics except as a
    // support message (or nothing at all). No raw componentStack (can embed
    // prop values); message + name are enough to spot a recurring crash.
    trackEvent('Root render crashed', { errorMessage: error.message, errorName: error.name })
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="root-error-boundary">
        <div className="root-error-boundary-content">
          <h1>Atlas needs a refresh</h1>
          <p>
            The app could not finish loading. This usually means Atlas was updated while the page was open.
          </p>
          <button
            type="button"
            onClick={() => {
              trackEvent('Root error reload clicked')
              if (window.__atlasRecover) window.__atlasRecover(true)
              else window.location.reload()
            }}
          >
            Reload latest version
          </button>
        </div>
      </main>
    )
  }
}

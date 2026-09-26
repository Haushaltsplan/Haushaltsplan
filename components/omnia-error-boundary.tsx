'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class OmniaErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[omnia]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-12 text-center">
          <p className="text-lg font-semibold text-[var(--app-text)]">Etwas ist schiefgelaufen</p>
          <p className="max-w-sm text-sm text-[var(--app-text-muted)]">
            Die Ansicht konnte nicht geladen werden. Bitte neu laden.
          </p>
          <button
            type="button"
            className="app-touch-target app-press rounded-xl bg-[var(--app-accent)] px-5 py-3 text-sm font-semibold text-[#041016]"
            onClick={() => {
              this.setState({ error: null })
              window.location.reload()
            }}
          >
            Neu laden
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

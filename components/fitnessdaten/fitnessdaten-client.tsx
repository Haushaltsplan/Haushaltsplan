'use client'

import { WhoopDashboard } from '@/components/fitnessdaten/whoop-dashboard'
import { useWhoopBle } from '@/components/fitnessdaten/whoop-ble-provider'
import { PageChrome } from '@/components/page-shell'
import { ladeFitnessSnapshot, loescheFitnessDaten } from '@/lib/fitnessdaten/history-storage'
import { WHOOP_BLE_SNAPSHOT_EVENT } from '@/lib/fitnessdaten/whoop-ble-keepalive'
import { WHOOP_CLOUD_SYNC_EVENT } from '@/lib/fitnessdaten/whoop-cloud-merge'
import type { FitnessSnapshot } from '@/lib/fitnessdaten/types'
import { useSearchParams } from 'next/navigation'
import { Component, useCallback, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import toast from 'react-hot-toast'

class WhoopErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[whoop]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-lg rounded-2xl border border-rose-800/50 bg-rose-950/35 p-6">
          <h1 className="text-lg font-bold text-rose-100">Whoop-Seite abgestürzt</h1>
          <p className="mt-2 text-sm text-[var(--app-text-muted)]">
            {this.state.error.message || 'Unbekannter Fehler beim Rendern.'}
          </p>
          <button
            type="button"
            className="mt-4 rounded-xl bg-[var(--app-surface-muted)] px-4 py-2.5 text-sm font-bold text-[var(--app-text)]"
            onClick={() => this.setState({ error: null })}
          >
            Erneut versuchen
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export function FitnessdatenClient() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') === 'health' ? ('health' as const) : undefined
  const { phase, snapshot: bleSnapshot } = useWhoopBle()
  const [snapshot, setSnapshot] = useState<FitnessSnapshot | null>(null)

  useEffect(() => {
    setSnapshot(bleSnapshot ?? ladeFitnessSnapshot())
  }, [bleSnapshot])

  useEffect(() => {
    const onSnap = (ev: Event) => {
      const detail = (ev as CustomEvent<FitnessSnapshot>).detail
      if (detail) setSnapshot(detail)
    }
    const onCloud = () => setSnapshot(ladeFitnessSnapshot())
    window.addEventListener(WHOOP_BLE_SNAPSHOT_EVENT, onSnap)
    window.addEventListener(WHOOP_CLOUD_SYNC_EVENT, onCloud)
    return () => {
      window.removeEventListener(WHOOP_BLE_SNAPSHOT_EVENT, onSnap)
      window.removeEventListener(WHOOP_CLOUD_SYNC_EVENT, onCloud)
    }
  }, [])

  const loescheDaten = useCallback(() => {
    if (!window.confirm('Alle WHOOP-Daten in diesem Browser löschen?')) return
    loescheFitnessDaten()
    setSnapshot(null)
    toast.success('Daten gelöscht.')
  }, [])

  return (
    <PageChrome density="compact" className="max-w-2xl min-w-0">
      <WhoopErrorBoundary>
        <WhoopDashboard
          snapshot={snapshot}
          phase={phase}
          onSnapshot={setSnapshot}
          onPhaseChange={() => {}}
          initialTab={initialTab}
        />
      </WhoopErrorBoundary>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-[var(--app-text-muted)]">
        <button
          type="button"
          onClick={loescheDaten}
          className="underline-offset-2 hover:text-[var(--app-text)] hover:underline"
        >
          Alle Daten löschen
        </button>
        <span className="hidden sm:inline">·</span>
        <span>Lokal · abofrei · Omnia</span>
      </div>
    </PageChrome>
  )
}

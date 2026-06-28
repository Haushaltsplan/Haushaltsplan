'use client'

import { WhoopDashboard } from '@/components/fitnessdaten/whoop-dashboard'
import { useWhoopBle } from '@/components/fitnessdaten/whoop-ble-provider'
import { PageChrome } from '@/components/page-shell'
import { ladeFitnessSnapshot, loescheFitnessDaten } from '@/lib/fitnessdaten/history-storage'
import {
  WHOOP_BLE_PHASE_EVENT,
  WHOOP_BLE_SNAPSHOT_EVENT,
} from '@/lib/fitnessdaten/whoop-ble-keepalive'
import { WHOOP_CLOUD_SYNC_EVENT } from '@/lib/fitnessdaten/whoop-cloud-merge'
import type { FitnessSnapshot } from '@/lib/fitnessdaten/types'
import type { WhoopWebBlePhase } from '@/lib/fitnessdaten/web-bluetooth-whoop'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

export function FitnessdatenClient() {
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
      <WhoopDashboard
        snapshot={snapshot}
        phase={phase}
        onSnapshot={setSnapshot}
        onPhaseChange={() => {}}
      />

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

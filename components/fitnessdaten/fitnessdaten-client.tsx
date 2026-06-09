'use client'

import { WhoopDashboard } from '@/components/fitnessdaten/whoop-dashboard'
import { useWhoopBle } from '@/components/fitnessdaten/whoop-ble-provider'
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
  const { phase, snapshot: bleSnapshot, verbinden } = useWhoopBle()
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
    <div className="mx-auto max-w-lg px-3 py-4 sm:max-w-xl sm:px-4 sm:py-6 lg:max-w-2xl">
      <WhoopDashboard
        snapshot={snapshot}
        phase={phase}
        onSnapshot={setSnapshot}
        onPhaseChange={() => {}}
      />

      {phase === 'idle' ? (
        <button
          type="button"
          onClick={() => void verbinden('whoop')}
          className="mt-4 w-full rounded-2xl border border-orange-500/30 bg-orange-950/20 py-3 text-sm font-semibold text-orange-200 transition hover:bg-orange-950/40"
        >
          WHOOP verbinden
        </button>
      ) : null}

      <div className="mt-6 flex justify-center gap-4 text-[11px] text-zinc-600">
        <button type="button" onClick={loescheDaten} className="underline-offset-2 hover:text-zinc-400 hover:underline">
          Alle Daten löschen
        </button>
        <span>·</span>
        <span>Lokal · abofrei · Omnia</span>
      </div>
    </div>
  )
}

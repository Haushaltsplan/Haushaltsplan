'use client'

import { WhoopDashboard } from '@/components/fitnessdaten/whoop-dashboard'
import { FitnessWhoopBlePanel } from '@/components/fitnessdaten/fitness-whoop-ble-panel'
import { ladeFitnessSnapshot, loescheFitnessDaten } from '@/lib/fitnessdaten/history-storage'
import type { FitnessSnapshot } from '@/lib/fitnessdaten/types'
import type { WhoopWebBlePhase } from '@/lib/fitnessdaten/web-bluetooth-whoop'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

export function FitnessdatenClient() {
  const [snapshot, setSnapshot] = useState<FitnessSnapshot | null>(null)
  const [phase, setPhase] = useState<WhoopWebBlePhase>('idle')
  const [showConnect, setShowConnect] = useState(false)

  useEffect(() => {
    setSnapshot(ladeFitnessSnapshot())
  }, [])

  const loescheDaten = useCallback(() => {
    if (!window.confirm('Alle Fitnessdaten in diesem Browser löschen?')) return
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
        onPhaseChange={setPhase}
      />

      {/* Schnellzugriff Verbinden wenn offline */}
      {phase === 'idle' && !showConnect ? (
        <button
          type="button"
          onClick={() => setShowConnect(true)}
          className="mt-4 w-full rounded-2xl border border-orange-500/30 bg-orange-950/20 py-3 text-sm font-semibold text-orange-200 transition hover:bg-orange-950/40"
        >
          WHOOP verbinden
        </button>
      ) : null}

      {showConnect && phase === 'idle' ? (
        <div className="mt-4">
          <FitnessWhoopBlePanel
            onSnapshot={setSnapshot}
            onPhaseChange={(p) => {
              setPhase(p)
              if (p === 'live') setShowConnect(false)
            }}
          />
        </div>
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

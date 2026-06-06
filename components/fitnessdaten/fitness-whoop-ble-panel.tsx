'use client'

import {
  ladeFitnessSnapshot,
  speichereFitnessSnapshot,
} from '@/lib/fitnessdaten/snapshot-storage'
import type { FitnessSnapshot } from '@/lib/fitnessdaten/types'
import {
  verbindeWhoopStandardHr,
  webBluetoothVerfuegbar,
  type WhoopWebBlePhase,
} from '@/lib/fitnessdaten/web-bluetooth-whoop'
import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

type Props = {
  onSnapshot: (s: FitnessSnapshot | null) => void
}

export function FitnessWhoopBlePanel({ onSnapshot }: Props) {
  const [phase, setPhase] = useState<WhoopWebBlePhase>('idle')
  const [deviceName, setDeviceName] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [bleOk] = useState(() => webBluetoothVerfuegbar())
  const disconnectRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => disconnectRef.current?.()
  }, [])

  const trennen = useCallback(() => {
    disconnectRef.current?.()
    disconnectRef.current = null
    setPhase('idle')
    setDeviceName(null)
    setFehler(null)
  }, [])

  const verbinden = useCallback(async () => {
    setFehler(null)
    try {
      const session = await verbindeWhoopStandardHr(({ phase: p, deviceName: n, snapshot, error }) => {
        setPhase(p)
        setDeviceName(n)
        setFehler(error)
        if (snapshot) {
          speichereFitnessSnapshot(snapshot)
          onSnapshot(snapshot)
        }
      })
      disconnectRef.current = session.disconnect
      toast.success('WHOOP verbunden — warte auf Puls …')
    } catch {
      /* Fehler bereits in onUpdate */
    }
  }, [onSnapshot])

  const phaseLabel: Record<WhoopWebBlePhase, string> = {
    idle: 'Nicht verbunden',
    connecting: 'Verbinde …',
    live: 'Live',
    error: 'Fehler',
  }

  return (
    <div className="rounded-xl border border-orange-800/45 bg-gradient-to-b from-orange-950/25 to-zinc-950/50 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-orange-300/90">
            Direkt in Omnia · Web Bluetooth
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            WHOOP 5.0: Puls + RR über Standard-BLE —{' '}
            <span className="font-medium text-zinc-200">{phaseLabel[phase]}</span>
            {deviceName ? ` · ${deviceName}` : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {phase === 'live' || phase === 'connecting' ? (
            <button
              type="button"
              onClick={trennen}
              className="rounded-xl border border-zinc-600 bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800"
            >
              Trennen
            </button>
          ) : (
            <button
              type="button"
              disabled={!bleOk}
              onClick={() => void verbinden()}
              className="rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-950/30 transition hover:bg-orange-500 disabled:opacity-40"
            >
              WHOOP verbinden
            </button>
          )}
        </div>
      </div>

      {!bleOk ? (
        <p className="mt-3 text-sm leading-relaxed text-amber-200/90">
          Web Bluetooth fehlt hier. Nutze <strong>Chrome oder Edge</strong> auf dem Gerät mit Bluetooth (Handy oder PC).
          Auf dem iPhone funktioniert es in Safari nicht — dort Android oder Desktop.
        </p>
      ) : (
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          Band am Handgelenk, geladen, Bluetooth an. Beim Klick erscheint die Geräteliste — WHOOP auswählen. IMU &
          Historie (Custom fd4b) folgen später; Puls + HRV-Basis laufen schon in der Web-App.
        </p>
      )}

      {fehler ? (
        <p className="mt-3 rounded-lg border border-rose-800/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
          {fehler}
        </p>
      ) : null}
    </div>
  )
}

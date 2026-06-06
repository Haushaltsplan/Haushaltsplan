'use client'

import type { FitnessSnapshot } from '@/lib/fitnessdaten/types'
import { speichereFitnessSnapshot } from '@/lib/fitnessdaten/snapshot-storage'
import {
  istMobileBrowser,
  verbindeWhoopStandardHr,
  webBluetoothVerfuegbar,
  type WhoopWebBleDebug,
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
  const [statusHint, setStatusHint] = useState<string | null>(null)
  const [debug, setDebug] = useState<WhoopWebBleDebug | null>(null)
  const [bleOk] = useState(() => webBluetoothVerfuegbar())
  const [mobile] = useState(() => istMobileBrowser())
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
    setStatusHint(null)
    setDebug(null)
  }, [])

  const verbinden = useCallback(async () => {
    setFehler(null)
    setStatusHint(null)
    setDebug(null)
    try {
      const session = await verbindeWhoopStandardHr(
        ({ phase: p, deviceName: n, snapshot, error, statusHint: hint, debug: d }) => {
          setPhase(p)
          setDeviceName(n)
          setFehler(error)
          setStatusHint(hint)
          setDebug(d)
          if (snapshot?.live?.heartRateBpm != null && snapshot.live.heartRateBpm > 0) {
            speichereFitnessSnapshot(snapshot)
            onSnapshot(snapshot)
          }
        },
      )
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
    waiting_hr: 'Warte auf Puls',
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
          {phase === 'live' || phase === 'connecting' || phase === 'waiting_hr' ? (
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
        <div className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-500">
          {!mobile ? (
            <p className="rounded-lg border border-sky-800/40 bg-sky-950/25 px-3 py-2 text-sky-100/90">
              <strong>Tipp für WHOOP 5.0:</strong> Am PC verbindet sich Omnia oft, liefert aber keinen Puls. Öffne
              dieselbe Seite in <strong>Chrome auf deinem Android-Handy</strong> (WHOOP in Reichweite) — das ist der
              zuverlässigere Weg.
            </p>
          ) : null}
          <p>
            Band am Handgelenk, geladen, Bluetooth an. Offizielle WHOOP-App während des Tests schließen. 10–30 s warten.
          </p>
        </div>
      )}

      {statusHint ? (
        <p className="mt-3 rounded-lg border border-amber-800/45 bg-amber-950/25 px-3 py-2 text-sm text-amber-100/90">
          {statusHint}
        </p>
      ) : null}

      {fehler ? (
        <p className="mt-3 rounded-lg border border-rose-800/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
          {fehler}
        </p>
      ) : null}

      {debug && (phase === 'waiting_hr' || phase === 'live') ? (
        <div className="mt-3 rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-500">
          <p className="font-semibold text-zinc-400">
            Diagnose
            {phase === 'waiting_hr' && debug.notifyCount === 0 ? (
              <span className="ml-2 font-normal text-amber-300/90">— noch kein Pulssignal</span>
            ) : null}
          </p>
          <ul className="mt-2 space-y-1 font-mono">
            <li>BLE-Signale (HR): {debug.notifyCount}</li>
            {debug.batteryPercent != null ? <li>Akku (GATT-Test): {debug.batteryPercent} %</li> : null}
            {debug.hrCharUuid ? <li>HR-Char: {debug.hrCharUuid.slice(0, 13)}…</li> : null}
            {debug.lastRawHex ? <li>Letzte Bytes: {debug.lastRawHex}</li> : null}
            {debug.enableLog.map((line) => (
              <li key={line}>{line}</li>
            ))}
            {debug.services.length > 0 ? (
              <li className="break-all">Services: {debug.services.map((u) => u.slice(0, 8)).join(', ')}</li>
            ) : null}
          </ul>
          {phase === 'waiting_hr' && debug.notifyCount === 0 && !mobile ? (
            <p className="mt-2 text-sky-200/85">
              Am PC ist „verbunden“ oft nur die GATT-Verbindung — der Puls kommt zuverlässiger über Chrome auf dem
              Android-Handy.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

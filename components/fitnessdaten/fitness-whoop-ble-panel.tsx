'use client'

import { mergeLiveSnapshot } from '@/lib/fitnessdaten/history-storage'
import type { FitnessSnapshot } from '@/lib/fitnessdaten/types'
import {
  istMobileBrowser,
  verbindeWhoopStandardHr,
  webBluetoothVerfuegbar,
  WHOOP_WIEDERHERSTELLUNG,
  type WhoopDeviceAuswahl,
  type WhoopWebBleDebug,
  type WhoopWebBlePhase,
} from '@/lib/fitnessdaten/web-bluetooth-whoop'
import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

type Props = {
  onSnapshot: (s: FitnessSnapshot | null) => void
  onPhaseChange?: (p: WhoopWebBlePhase) => void
  embedded?: boolean
}

export function FitnessWhoopBlePanel({ onSnapshot, onPhaseChange, embedded = false }: Props) {
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

  const setPhaseBoth = useCallback(
    (p: WhoopWebBlePhase) => {
      setPhase(p)
      onPhaseChange?.(p)
    },
    [onPhaseChange],
  )

  const trennen = useCallback(() => {
    disconnectRef.current?.()
    disconnectRef.current = null
    setPhaseBoth('idle')
    setDeviceName(null)
    setFehler(null)
    setStatusHint(null)
    setDebug(null)
  }, [setPhaseBoth])

  const verbinden = useCallback(
    async (auswahl: WhoopDeviceAuswahl = 'whoop') => {
      setFehler(null)
      setStatusHint(null)
      setDebug(null)
      try {
        const session = await verbindeWhoopStandardHr(
        ({ phase: p, deviceName: n, snapshot, error, statusHint: hint, debug: d, gen5: g5 }) => {
          setPhaseBoth(p)
          setDeviceName(n)
          setFehler(error)
          setStatusHint(hint)
          setDebug(d)
          const snap = snapshot ? { ...snapshot, gen5: g5 ?? snapshot.gen5 } : null
          if (snap?.live?.heartRateBpm != null && snap.live.heartRateBpm > 0) {
            onSnapshot(mergeLiveSnapshot(snap, snap.deviceInfo))
          } else if (snap && (snap.live?.accel || snap.live?.skinTempC != null || snap.gen5)) {
            onSnapshot(mergeLiveSnapshot(snap, snap.deviceInfo))
          } else if (snap?.gen5) {
            onSnapshot(snap)
          }
        },
          auswahl,
        )
        disconnectRef.current = session.disconnect
        toast.success('WHOOP verbunden')
      } catch {
        /* Fehler bereits in onUpdate */
      }
    },
    [onSnapshot, setPhaseBoth],
  )

  const phaseLabel: Record<WhoopWebBlePhase, string> = {
    idle: 'Nicht verbunden',
    connecting: 'Verbinde …',
    live: 'Live',
    waiting_hr: 'Warte auf Puls',
    error: 'Fehler',
  }

  const shell = embedded
    ? 'rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4'
    : 'rounded-xl border border-orange-800/45 bg-gradient-to-b from-orange-950/25 to-zinc-950/50 p-4 sm:p-5'

  return (
    <div className={shell}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p
            className={`text-[11px] font-bold uppercase tracking-[0.16em] ${embedded ? 'text-zinc-500' : 'text-orange-300/90'}`}
          >
            Web Bluetooth · WHOOP 5.0
          </p>
          <p className="mt-1 text-sm text-zinc-400">
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
            <>
              <button
                type="button"
                disabled={!bleOk}
                onClick={() => void verbinden('whoop')}
                className="rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-950/30 transition hover:bg-orange-500 disabled:opacity-40"
              >
                Verbinden
              </button>
              <button
                type="button"
                disabled={!bleOk}
                onClick={() => void verbinden('alle')}
                className="rounded-xl border border-zinc-600 bg-zinc-900 px-3 py-2.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-40"
              >
                Alle scannen
              </button>
            </>
          )}
        </div>
      </div>

      {!bleOk ? (
        <p className="mt-3 text-sm leading-relaxed text-amber-200/90">
          Web Bluetooth fehlt. Chrome/Edge auf HTTPS — auf dem iPhone nicht in Safari.
        </p>
      ) : (
        <ol className="mt-3 list-decimal space-y-1.5 rounded-lg border border-white/[0.06] bg-black/30 px-4 py-3 text-xs text-zinc-400 marker:text-orange-500">
          <li>WHOOP-App → Gerät → <strong className="text-zinc-200">HR Broadcast</strong> an</li>
          <li>Band am Handgelenk, hier verbinden</li>
        </ol>
      )}

      {!embedded ? (
        <details className="mt-3 rounded-lg border border-zinc-700/60 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">
          <summary className="cursor-pointer font-semibold text-zinc-300">WHOOP nicht gefunden?</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            {WHOOP_WIEDERHERSTELLUNG.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </details>
      ) : null}

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
        <details className="mt-3 rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-500">
          <summary className="cursor-pointer font-semibold text-zinc-400">Technische Diagnose</summary>
          <ul className="mt-2 space-y-1 font-mono">
            <li>BLE-Signale: {debug.notifyCount}</li>
            <li>Notify: {debug.notifyStarted ? 'ja' : 'nein'}</li>
            {debug.batteryPercent != null ? <li>Akku: {debug.batteryPercent}%</li> : null}
            {debug.lastRawHex ? <li>Bytes: {debug.lastRawHex}</li> : null}
          </ul>
        </details>
      ) : null}
    </div>
  )
}

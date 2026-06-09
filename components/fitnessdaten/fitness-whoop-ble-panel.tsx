'use client'

import { useWhoopBle } from '@/components/fitnessdaten/whoop-ble-provider'
import { istWhoopBleAlwaysOn, setzeWhoopBleAlwaysOn } from '@/lib/fitnessdaten/whoop-ble-keepalive'
import { istMobileBrowser, WHOOP_WIEDERHERSTELLUNG } from '@/lib/fitnessdaten/web-bluetooth-whoop'
import { useEffect, useState } from 'react'

type Props = {
  embedded?: boolean
}

export function FitnessWhoopBlePanel({ embedded = false }: Props) {
  const { phase, deviceName, fehler, statusHint, debug, bleOk, verbinden, trennen } = useWhoopBle()
  const mobile = istMobileBrowser()
  const [alwaysOn, setAlwaysOn] = useState(true)

  useEffect(() => {
    setAlwaysOn(istWhoopBleAlwaysOn())
  }, [])

  const phaseLabel: Record<typeof phase, string> = {
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
          <p className="mt-1 text-[10px] text-zinc-600">
            Läuft app-weit im Hintergrund — Reconnect alle 12 s, Nähe-Erkennung (Android), Cloud-Sync per
            Service Worker.
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

      <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2.5">
        <input
          type="checkbox"
          checked={alwaysOn}
          onChange={(e) => {
            const an = e.target.checked
            setAlwaysOn(an)
            setzeWhoopBleAlwaysOn(an)
          }}
          className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-orange-500"
        />
        <span className="text-xs leading-relaxed text-zinc-400">
          <strong className="text-zinc-200">Dauerhaft verbunden</strong> — Omnia verbindet WHOOP automatisch
          neu (auch bei minimierter App). Omnia als PWA installieren und nicht „Beenden erzwingen“. Wenn die
          App komplett beendet ist, holt der Hintergrund-Sync WHOOP-Cloud-Daten; BLE startet beim nächsten
          Öffnen sofort.
        </span>
      </label>

      {!bleOk ? (
        <p className="mt-3 text-sm leading-relaxed text-amber-200/90">
          Web Bluetooth fehlt. Chrome/Edge auf HTTPS — auf dem iPhone nicht in Safari.
        </p>
      ) : (
        <ol className="mt-3 list-decimal space-y-1.5 rounded-lg border border-white/[0.06] bg-black/30 px-4 py-3 text-xs text-zinc-400 marker:text-orange-500">
          <li>WHOOP-App → Gerät → <strong className="text-zinc-200">HR Broadcast</strong> an</li>
          <li>Band am Handgelenk — Verbindung hält über App-Sperre{mobile ? '' : ' (Handy zuverlässiger als PC)'}</li>
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

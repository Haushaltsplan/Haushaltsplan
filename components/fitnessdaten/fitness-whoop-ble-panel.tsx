'use client'

import { useWhoopBle } from '@/components/fitnessdaten/whoop-ble-provider'
import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
import { istWhoopBleAlwaysOn, setzeWhoopBleAlwaysOn } from '@/lib/fitnessdaten/whoop-ble-keepalive'
import { istMobileBrowser, WHOOP_WIEDERHERSTELLUNG } from '@/lib/fitnessdaten/web-bluetooth-whoop'
import { registerPlugin } from '@capacitor/core'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

type Props = {
  embedded?: boolean
}

type BattPlugin = {
  isBatteryOptimized: () => Promise<{ ignored: boolean }>
}

export function FitnessWhoopBlePanel({ embedded = false }: Props) {
  const { phase, deviceName, fehler, statusHint, debug, bleOk, verbinden, trennen } = useWhoopBle()
  const mobile = istMobileBrowser()
  const native = istOmniaNativeApp()
  const [alwaysOn, setAlwaysOn] = useState(true)
  const [akkuOk, setAkkuOk] = useState<boolean | null>(null)

  useEffect(() => {
    setAlwaysOn(istWhoopBleAlwaysOn())
  }, [])

  useEffect(() => {
    if (!native) return
    void (async () => {
      try {
        const P = registerPlugin<BattPlugin>('OmniaBleKeepalive')
        const r = await P.isBatteryOptimized()
        setAkkuOk(r.ignored)
      } catch {
        setAkkuOk(null)
      }
    })()
  }, [native])

  const oeffneAkku = async () => {
    try {
      const { oeffneAkkuEinstellungen } = await import(
        '@/lib/fitnessdaten/omnia-ble-keepalive-native'
      )
      await oeffneAkkuEinstellungen()
    } catch {
      toast.error('Akku-Einstellungen nicht erreichbar')
    }
  }

  const phaseLabel: Record<typeof phase, string> = {
    idle: 'Nicht verbunden',
    connecting: 'Verbinde …',
    live: 'Live',
    waiting_hr: 'Warte auf Puls',
    error: 'Fehler',
  }

  const shell = embedded
    ? 'rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4'
    : 'rounded-xl border border-orange-800/45 bg-gradient-to-b from-orange-950/25 to-[var(--app-surface-muted)] p-4 sm:p-5'

  return (
    <div className={shell}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p
            className={`text-[11px] font-bold uppercase tracking-[0.16em] ${embedded ? 'text-[var(--app-text-muted)]' : 'text-orange-300/90'}`}
          >
            {native ? 'Omnia Native · BLE' : 'Browser / PWA · BLE'}
          </p>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">
            <span className="font-medium text-[var(--app-text)]">{phaseLabel[phase]}</span>
            {deviceName ? ` · ${deviceName}` : null}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
            {native
              ? 'Native App: Foreground-Dienst hält WHOOP bei Standby/Minimieren. Dauerhaft an + Akku „Uneingeschränkt“.'
              : 'Im Browser/PWA beendet Android BLE, sobald die App zu ist. Für Dauer-Verbindung: native Omnia-App.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {phase === 'live' || phase === 'connecting' || phase === 'waiting_hr' ? (
            <button
              type="button"
              onClick={trennen}
              className="rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-4 py-2.5 text-xs font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-surface-hover)]"
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
                className="rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2.5 text-xs font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-surface-hover)] disabled:opacity-40"
              >
                Alle scannen
              </button>
            </>
          )}
        </div>
      </div>

      {!native ? (
        <p className="mt-3 rounded-lg border border-amber-800/40 bg-amber-950/30 px-3 py-2 text-[12px] leading-relaxed text-amber-100/90">
          Du nutzt gerade Browser/PWA — Dauer-BLE mit geschlossenem Handy ist technisch nicht möglich.
          Lösung: Omnia als Android-App (Capacitor) mit dem Keepalive-Dienst.
        </p>
      ) : null}

      <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2.5">
        <input
          type="checkbox"
          checked={alwaysOn}
          onChange={(e) => {
            const an = e.target.checked
            setAlwaysOn(an)
            setzeWhoopBleAlwaysOn(an)
          }}
          className="mt-0.5 h-4 w-4 rounded border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] text-orange-500"
        />
        <span className="text-xs leading-relaxed text-[var(--app-text-muted)]">
          <strong className="text-[var(--app-text)]">Dauerhaft verbunden</strong>
          {native
            ? ' — Auto-Reconnect + nativer Hintergrund-Dienst (Benachrichtigung „WHOOP verbunden“). App nur schließen/minimieren, nicht aus den Einstellungen beenden.'
            : ' — Reconnect nur solange der Tab/PWA-Prozess läuft. Geschlossene App = BLE tot (Browser-Limit).'}
        </span>
      </label>

      {native ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void oeffneAkku()}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-zinc-200"
          >
            Akku-Optimierung öffnen
          </button>
          {akkuOk === false ? (
            <span className="text-[10px] text-amber-300">
              Bitte Omnia auf „Uneingeschränkt“ setzen — sonst killt Android den BLE-Dienst.
            </span>
          ) : akkuOk === true ? (
            <span className="text-[10px] text-emerald-400">Akku-Optimierung aus · gut</span>
          ) : null}
        </div>
      ) : null}

      {!bleOk ? (
        <p className="mt-3 text-sm leading-relaxed text-amber-200/90">
          Web Bluetooth fehlt. Chrome/Edge auf HTTPS — auf dem iPhone nicht in Safari.
        </p>
      ) : (
        <ol className="mt-3 list-decimal space-y-1.5 rounded-lg border border-white/[0.06] bg-black/30 px-4 py-3 text-xs text-[var(--app-text-muted)] marker:text-orange-500">
          <li>
            WHOOP-App → Gerät → <strong className="text-[var(--app-text)]">HR Broadcast</strong> an
          </li>
          <li>
            {native
              ? 'Verbinden → gelbe Dauer-Benachrichtigung sollte bleiben, wenn du Omnia minimierst'
              : 'Für Standby: native Omnia-App statt Browser'}
            {mobile ? '' : ' (Handy zuverlässiger als PC)'}
          </li>
        </ol>
      )}

      <details className="mt-3 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2 text-xs text-[var(--app-text-muted)]">
        <summary className="cursor-pointer font-semibold text-[var(--app-text)]">
          Standby &amp; Timeout
        </summary>
        <ul className="mt-2 list-disc space-y-1.5 pl-4 leading-relaxed">
          <li>
            <strong className="text-[var(--app-text)]">Native Omnia (Android)</strong>: Foreground Service hält
            BLE bei Standby. Akku → Uneingeschränkt. Nicht „Beenden erzwingen“.
          </li>
          <li>
            <strong className="text-[var(--app-text)]">Browser/PWA</strong>: System trennt BLE beim Schließen —
            Historie holt Omnia beim nächsten Öffnen vom Band nach.
          </li>
          <li>
            <strong className="text-[var(--app-text)]">Cloud-Sync</strong> (mit Abo): läuft ohne BLE für
            Whoop-Vergleich — ersetzt aber keine Omnia-Shadows.
          </li>
        </ul>
      </details>

      {!embedded ? (
        <details className="mt-3 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2 text-xs text-[var(--app-text-muted)]">
          <summary className="cursor-pointer font-semibold text-[var(--app-text)]">WHOOP nicht gefunden?</summary>
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
        <details className="mt-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-xs text-[var(--app-text-muted)]">
          <summary className="cursor-pointer font-semibold text-[var(--app-text-muted)]">Technische Diagnose</summary>
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

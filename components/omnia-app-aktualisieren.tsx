'use client'

import { aktualisiereOmniaApp } from '@/lib/fitnessdaten/omnia-app-aktualisieren'
import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
import { OmniaNativeVersionLabel } from '@/components/omnia-native-version'
import { oeffneAkkuEinstellungen } from '@/lib/fitnessdaten/omnia-ble-keepalive-native'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

/**
 * Holt den neuesten Deploy von der Server-URL (Hard-Reload + Cache leeren).
 * In der echten Capacitor-App: kein Neuinstallieren nötig.
 */
export function OmniaAppAktualisieren() {
  const [busy, setBusy] = useState(false)
  const [akkuOk, setAkkuOk] = useState<boolean | null>(null)
  const native = typeof window !== 'undefined' && istOmniaNativeApp()

  useEffect(() => {
    if (!native) return
    void (async () => {
      try {
        const { omniaBleKeepalivePlugin } = await import(
          '@/lib/fitnessdaten/omnia-ble-keepalive-native'
        )
        const r = await omniaBleKeepalivePlugin().isBatteryOptimized()
        setAkkuOk(r.ignored)
      } catch {
        setAkkuOk(null)
      }
    })()
  }, [native])

  const onClick = async () => {
    if (busy) return
    setBusy(true)
    toast.loading('Aktualisiere …', { id: 'omnia-aktualisieren' })
    try {
      await aktualisiereOmniaApp()
    } catch {
      toast.error('Aktualisieren fehlgeschlagen', { id: 'omnia-aktualisieren' })
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-[var(--app-text-muted)]">
        {native
          ? 'Nach einem Deploy tippst du hier — die echte Omnia-App lädt den neuen Stand von der Server-URL. Kein Löschen, kein Neuinstallieren.'
          : 'Lädt die Seite neu und leert den Cache. Für Dauer-BLE und Hintergrund brauchst du die echte Omnia-APK (nicht die heruntergeladene Website).'}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onClick()}
        className="app-touch-target app-press rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:opacity-50"
      >
        {busy ? 'Aktualisiere …' : 'App aktualisieren'}
      </button>
      <OmniaNativeVersionLabel />
      {native ? (
        <div className="space-y-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3">
          <p className="text-[11px] text-emerald-500/90">Native Omnia-App erkannt</p>
          {akkuOk === false ? (
            <button
              type="button"
              className="app-touch-target app-press text-left text-sm font-medium text-amber-400 underline-offset-2 hover:underline"
              onClick={() => void oeffneAkkuEinstellungen()}
            >
              Akku-Optimierung deaktivieren (wichtig für WHOOP)
            </button>
          ) : akkuOk === true ? (
            <p className="text-[11px] text-[var(--app-text-muted)]">Akku-Optimierung: erlaubt</p>
          ) : null}
        </div>
      ) : (
        <p className="text-[11px] text-amber-500/90">Browser / PWA — nicht die native APK</p>
      )}
    </div>
  )
}

'use client'

import { aktualisiereOmniaApp } from '@/lib/fitnessdaten/omnia-app-aktualisieren'
import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'
import { useState } from 'react'
import toast from 'react-hot-toast'

/**
 * Holt den neuesten Deploy von der Server-URL (Hard-Reload + Cache leeren).
 * In der echten Capacitor-App: kein Neuinstallieren nötig.
 */
export function OmniaAppAktualisieren() {
  const [busy, setBusy] = useState(false)
  const native = typeof window !== 'undefined' && istOmniaNativeApp()

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
        className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:opacity-50"
      >
        {busy ? 'Aktualisiere …' : 'App aktualisieren'}
      </button>
      {native ? (
        <p className="text-[11px] text-emerald-500/90">Native Omnia-App erkannt</p>
      ) : (
        <p className="text-[11px] text-amber-500/90">Browser / PWA — nicht die native APK</p>
      )}
    </div>
  )
}

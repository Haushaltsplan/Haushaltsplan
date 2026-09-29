'use client'

import {
  abonniereBleRekorder,
  bleRohpaketAnzahl,
  exportiereBleRohpaketeText,
  loescheBleRohpakete,
} from '@/lib/fitnessdaten/ble-packet-recorder'
import { useState, useSyncExternalStore } from 'react'
import toast from 'react-hot-toast'

export function WhoopBleRohpaketePanel() {
  const anzahl = useSyncExternalStore(abonniereBleRekorder, bleRohpaketAnzahl, () => 0)
  const [text, setText] = useState<string | null>(null)

  const kopieren = async () => {
    const t = exportiereBleRohpaketeText()
    setText(t)
    try {
      await navigator.clipboard.writeText(t)
      toast.success('Rohpakete kopiert — jetzt in Gemini einfügen')
    } catch {
      toast('Kopieren blockiert — Text unten markieren und kopieren')
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#12161F] p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8B93A1]">BLE-Rohpakete</p>
      <p className="mt-1 text-xs leading-relaxed text-[#8B93A1]">
        Zeichnet die Bytes vom Band auf (je Pakettyp die ersten und neuesten), damit unbekannte Felder
        analysiert werden können. Band ein paar Minuten tragen, idealerweise auch eine Nacht.
      </p>
      <p className="mt-2 text-sm text-white">
        <span className="text-2xl font-bold tabular-nums">{anzahl.toLocaleString('de-DE')}</span>
        <span className="ml-1 text-xs text-[#8B93A1]">Pakete empfangen</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void kopieren()}
          className="rounded-xl bg-[#00B2FE] px-4 py-2 text-xs font-bold text-[#0B0E14] transition hover:bg-[#00E5FF]"
        >
          Rohpakete kopieren
        </button>
        <button
          type="button"
          onClick={() => {
            loescheBleRohpakete()
            setText(null)
          }}
          className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-[#E5E7EB]"
        >
          Zurücksetzen
        </button>
      </div>
      {text ? (
        <textarea
          readOnly
          value={text}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-3 h-48 w-full rounded-xl border border-white/[0.08] bg-[#0B0E14] p-3 font-mono text-[10px] leading-relaxed text-[#E5E7EB] outline-none"
        />
      ) : null}
    </div>
  )
}

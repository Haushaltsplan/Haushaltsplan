'use client'

import {
  DISPLAY_SOURCE_EVENT,
  ladeDisplaySource,
  setzeDisplaySource,
  type DisplaySource,
} from '@/lib/fitnessdaten/calibration/display-source'
import { istOmniaOfflineMode } from '@/lib/fitnessdaten/calibration/omnia-offline-mode'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

/** Umschalter Whoop Cloud ↔ Omnia — alle Ringe/Metriken vergleichen. */
export function FitnessDisplaySourceToggle({ className = '' }: { className?: string }) {
  const [source, setSource] = useState<DisplaySource>('whoop')
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    setSource(ladeDisplaySource())
    setOffline(istOmniaOfflineMode())
    const onChange = () => {
      setSource(ladeDisplaySource())
      setOffline(istOmniaOfflineMode())
    }
    window.addEventListener(DISPLAY_SOURCE_EVENT, onChange)
    window.addEventListener('mein-haushalt:omnia-offline-mode', onChange)
    return () => {
      window.removeEventListener(DISPLAY_SOURCE_EVENT, onChange)
      window.removeEventListener('mein-haushalt:omnia-offline-mode', onChange)
    }
  }, [])

  const pick = (next: DisplaySource) => {
    if (offline && next === 'whoop') {
      toast.error('Offline-Modus aktiv — nur Omnia. Toggle im Kalibrierungs-Panel ausschalten.')
      return
    }
    setzeDisplaySource(next)
    setSource(next)
  }

  return (
    <div
      className={`inline-flex items-center rounded-full border border-white/10 bg-black/40 p-0.5 ${className}`}
      role="group"
      aria-label="Datenquelle"
    >
      <button
        type="button"
        onClick={() => pick('whoop')}
        disabled={offline}
        className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition ${
          source === 'whoop'
            ? 'bg-sky-500/25 text-sky-200'
            : 'text-zinc-500 hover:text-zinc-300 disabled:opacity-40'
        }`}
      >
        Whoop
      </button>
      <button
        type="button"
        onClick={() => pick('omnia')}
        className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition ${
          source === 'omnia'
            ? 'bg-emerald-500/25 text-emerald-200'
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        Omnia
      </button>
    </div>
  )
}

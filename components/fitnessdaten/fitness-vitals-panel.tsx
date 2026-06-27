'use client'

import { heuteIsoLocal } from '@/lib/fitnessdaten/scores'
import { fuegeVitalEintragHinzu, letzteVitalEintraege } from '@/lib/fitnessdaten/vitals-log'
import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'

type Props = {
  onSaved?: () => void
  embedded?: boolean
}

export function FitnessVitalsPanel({ onSaved, embedded = false }: Props) {
  const [sys, setSys] = useState('')
  const [dia, setDia] = useState('')
  const [spo2, setSpo2] = useState('')
  const [note, setNote] = useState('')

  const speichern = useCallback(() => {
    const bpSystolic = sys ? Number(sys) : null
    const bpDiastolic = dia ? Number(dia) : null
    const spo2Manual = spo2 ? Number(spo2) : null
    if (bpSystolic == null && bpDiastolic == null && spo2Manual == null) {
      toast.error('Mindestens einen Wert eintragen.')
      return
    }
    fuegeVitalEintragHinzu({
      date: heuteIsoLocal(),
      bpSystolic,
      bpDiastolic,
      spo2Manual,
      note: note.trim() || null,
    })
    setSys('')
    setDia('')
    setSpo2('')
    setNote('')
    toast.success('Vitalwert gespeichert.')
    onSaved?.()
  }, [sys, dia, spo2, note, onSaved])

  const letzte = letzteVitalEintraege(3)

  return (
    <div
      className={`rounded-2xl border border-rose-500/20 bg-[#111113] ${embedded ? 'p-4' : 'p-5'}`}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-rose-200">Vitalwerte</p>
      <p className="mt-2 text-xs leading-relaxed text-zinc-500">
        Blutdruck aus WHOOP Life manuell übernehmen (App → Health Monitor). SpO₂ optional als Zusatzmessung.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase text-zinc-500">Systole</span>
          <input
            type="number"
            placeholder="120"
            value={sys}
            onChange={(e) => setSys(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase text-zinc-500">Diastole</span>
          <input
            type="number"
            placeholder="80"
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none"
          />
        </label>
        <label className="block col-span-2">
          <span className="text-[10px] font-semibold uppercase text-zinc-500">SpO₂ optional (%)</span>
          <input
            type="number"
            step={0.1}
            placeholder="98"
            value={spo2}
            onChange={(e) => setSpo2(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none"
          />
        </label>
      </div>

      <input
        type="text"
        placeholder="Notiz (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mt-3 w-full rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-xs text-zinc-300 outline-none"
      />

      <button
        type="button"
        onClick={speichern}
        className="mt-3 w-full rounded-xl border border-rose-500/30 bg-rose-950/30 py-2.5 text-sm font-semibold text-rose-100 hover:bg-rose-950/50"
      >
        Speichern
      </button>

      {letzte.length > 0 ? (
        <ul className="mt-3 space-y-1 text-[10px] text-zinc-500">
          {letzte.map((v) => (
            <li key={v.id}>
              {v.date}:{' '}
              {v.bpSystolic != null && v.bpDiastolic != null
                ? `${v.bpSystolic}/${v.bpDiastolic} mmHg`
                : v.spo2Manual != null
                  ? `SpO₂ ${v.spo2Manual} %`
                  : '—'}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

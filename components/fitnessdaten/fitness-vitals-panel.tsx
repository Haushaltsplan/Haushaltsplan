'use client'

import { heuteIsoLocal } from '@/lib/fitnessdaten/scores'
import { fuegeVitalEintragHinzu, letzteVitalEintraege } from '@/lib/fitnessdaten/vitals-log'
import { ladeVo2Trends, setzeVo2MaxManuell } from '@/lib/fitnessdaten/vo2max-engine'
import { useCallback, useEffect, useState } from 'react'
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
  const [vo2Input, setVo2Input] = useState('')
  const [vo2Gespeichert, setVo2Gespeichert] = useState<number | null>(null)

  useEffect(() => {
    const s = ladeVo2Trends()
    setVo2Gespeichert(s.manuell)
  }, [])

  const speichernVo2 = useCallback(() => {
    const wert = vo2Input ? Number(vo2Input) : null
    if (wert != null && (wert < 20 || wert > 90)) {
      toast.error('VO₂ Max muss zwischen 20 und 90 ml/kg/min liegen.')
      return
    }
    const s = setzeVo2MaxManuell(wert)
    setVo2Gespeichert(s.manuell)
    setVo2Input('')
    toast.success(wert != null ? `VO₂ Max auf ${wert} gesetzt.` : 'VO₂ Max-Override gelöscht.')
    onSaved?.()
  }, [vo2Input, onSaved])

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

      {/* VO2max — Cloud Sync Hinweis + Notfall-Override */}
      <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-text)]">VO₂ Max</p>
            <p className="mt-0.5 text-[10px] text-[var(--app-text-muted)]">
              Wird automatisch via Cloud Sync geladen (Monatsdurchschnitt aus WHOOP)
            </p>
          </div>
          {vo2Gespeichert != null && (
            <span className="ml-3 shrink-0 rounded-lg bg-[var(--app-surface-muted)] px-2 py-1 text-sm font-bold tabular-nums text-[var(--app-text)]">
              {vo2Gespeichert}
            </span>
          )}
        </div>

        {/* Nur anzeigen wenn manueller Override aktiv */}
        {vo2Gespeichert != null ? (
          <div className="mt-2 flex items-center gap-2">
            <p className="flex-1 text-[10px] text-amber-500/80">
              Manueller Override aktiv: {vo2Gespeichert} ml/kg/min. Cloud Sync setzt diesen Wert zurück.
            </p>
            <button
              type="button"
              onClick={() => {
                setzeVo2MaxManuell(null)
                setVo2Gespeichert(null)
                toast.success('Override gelöscht — VO₂ Max kommt wieder aus Cloud Sync.')
                onSaved?.()
              }}
              className="rounded-lg border border-[var(--app-border-strong)] px-3 py-1.5 text-xs text-[var(--app-text-muted)] transition hover:text-[var(--app-text)]"
            >
              Override löschen
            </button>
          </div>
        ) : (
          /* Notfall-Override: nur zugänglich wenn Cloud Sync fehlschlägt */
          <details className="mt-2">
            <summary className="cursor-pointer text-[9px] text-[var(--app-text-muted)] hover:text-[var(--app-text-muted)]">
              Cloud Sync liefert keinen Wert? Notfall-Override
            </summary>
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                min={20}
                max={90}
                step={1}
                placeholder="z. B. 57"
                value={vo2Input}
                onChange={(e) => setVo2Input(e.target.value)}
                className="flex-1 rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-[var(--app-text)] tabular-nums outline-none focus:border-white/20"
              />
              <button
                type="button"
                onClick={speichernVo2}
                className="rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-surface-muted)]"
              >
                Setzen
              </button>
            </div>
            <p className="mt-1 text-[9px] text-[var(--app-text-muted)]">
              Nur nutzen wenn WHOOP Cloud Sync keinen VO₂ Max-Wert zurückgibt.
            </p>
          </details>
        )}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-[var(--app-text-muted)]">
        Blutdruck aus WHOOP Life manuell übernehmen (App → Health Monitor). SpO₂ optional als Zusatzmessung.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase text-[var(--app-text-muted)]">Systole</span>
          <input
            type="number"
            placeholder="120"
            value={sys}
            onChange={(e) => setSys(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-[var(--app-text)] outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase text-[var(--app-text-muted)]">Diastole</span>
          <input
            type="number"
            placeholder="80"
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-[var(--app-text)] outline-none"
          />
        </label>
        <label className="block col-span-2">
          <span className="text-[10px] font-semibold uppercase text-[var(--app-text-muted)]">SpO₂ optional (%)</span>
          <input
            type="number"
            step={0.1}
            placeholder="98"
            value={spo2}
            onChange={(e) => setSpo2(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-[var(--app-text)] outline-none"
          />
        </label>
      </div>

      <input
        type="text"
        placeholder="Notiz (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mt-3 w-full rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-xs text-[var(--app-text)] outline-none"
      />

      <button
        type="button"
        onClick={speichern}
        className="mt-3 w-full rounded-xl border border-rose-500/30 bg-rose-950/30 py-2.5 text-sm font-semibold text-rose-100 hover:bg-rose-950/50"
      >
        Speichern
      </button>

      {letzte.length > 0 ? (
        <ul className="mt-3 space-y-1 text-[10px] text-[var(--app-text-muted)]">
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

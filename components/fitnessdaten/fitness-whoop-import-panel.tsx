'use client'

import {
  downloadText,
  exportiereOmniaJson,
  importiereOmniaJson,
  importiereWhoopCsvDateien,
  type WhoopImportErgebnis,
} from '@/lib/fitnessdaten/whoop-import'
import { useCallback, useRef, useState } from 'react'
import toast from 'react-hot-toast'

type Props = {
  onImportComplete?: () => void
  embedded?: boolean
}

export function FitnessWhoopImportPanel({ onImportComplete, embedded = false }: Props) {
  const csvRef = useRef<HTMLInputElement>(null)
  const jsonRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [ergebnis, setErgebnis] = useState<WhoopImportErgebnis | null>(null)

  const nachImport = useCallback(
    (res: WhoopImportErgebnis) => {
      setErgebnis(res)
      if (res.ok) {
        toast.success(`${res.tageImportiert} Tage importiert (${res.tageNeu} neu)`)
        onImportComplete?.()
      } else {
        toast.error(res.fehler[0] ?? 'Import fehlgeschlagen')
      }
    },
    [onImportComplete],
  )

  const leseDateien = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return
      setBusy(true)
      setErgebnis(null)
      try {
        const dateien: { name: string; text: string }[] = []
        for (const f of Array.from(files)) {
          const lower = f.name.toLowerCase()
          if (!lower.endsWith('.csv') && !lower.endsWith('.txt')) continue
          dateien.push({ name: f.name, text: await f.text() })
        }
        if (dateien.length === 0) {
          toast.error('Keine CSV-Dateien ausgewählt.')
          return
        }
        nachImport(importiereWhoopCsvDateien(dateien))
      } finally {
        setBusy(false)
        if (csvRef.current) csvRef.current.value = ''
      }
    },
    [nachImport],
  )

  const leseJson = useCallback(
    async (file: File | null) => {
      if (!file) return
      setBusy(true)
      setErgebnis(null)
      try {
        nachImport(importiereOmniaJson(await file.text()))
      } finally {
        setBusy(false)
        if (jsonRef.current) jsonRef.current.value = ''
      }
    },
    [nachImport],
  )

  const exportBackup = useCallback(() => {
    downloadText(`omnia-fitnessdaten-${new Date().toISOString().slice(0, 10)}.json`, exportiereOmniaJson())
    toast.success('Backup heruntergeladen.')
  }, [])

  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-[#111113] ${embedded ? 'p-4' : 'p-5'}`}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--app-text)]">Daten importieren</p>
      <p className="mt-2 text-xs leading-relaxed text-[var(--app-text-muted)]">
        WHOOP-App → Profil → Datenschutz →{' '}
        <strong className="font-semibold text-[var(--app-text-muted)]">Daten exportieren</strong> → ZIP entpacken → CSVs
        hochladen. Unterstützt{' '}
        <code className="text-[var(--app-text-muted)]">physiological_cycles.csv</code>,{' '}
        <code className="text-[var(--app-text-muted)]">sleeps.csv</code>,{' '}
        <code className="text-[var(--app-text-muted)]">workouts.csv</code>,{' '}
        <code className="text-[var(--app-text-muted)]">journal_entries.csv</code>.
      </p>

      <div className="mt-4 space-y-3">
        <input
          ref={csvRef}
          type="file"
          accept=".csv,.txt,text/csv"
          multiple
          className="hidden"
          onChange={(e) => void leseDateien(e.target.files)}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => csvRef.current?.click()}
          className="w-full rounded-xl border border-sky-500/30 bg-sky-950/30 py-3 text-sm font-semibold text-sky-200 transition hover:bg-sky-950/50 disabled:opacity-50"
        >
          {busy ? 'Importiere …' : 'WHOOP-CSV importieren'}
        </button>

        <input
          ref={jsonRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => void leseJson(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => jsonRef.current?.click()}
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-sm font-medium text-[var(--app-text)] transition hover:bg-white/[0.06] disabled:opacity-50"
        >
          Omnia-Backup (JSON) importieren
        </button>

        <button
          type="button"
          onClick={exportBackup}
          className="w-full rounded-xl border border-white/[0.06] py-2.5 text-sm font-medium text-[var(--app-text-muted)] transition hover:text-[var(--app-text)]"
        >
          Omnia-Backup exportieren
        </button>
      </div>

      {ergebnis ? (
        <div
          className={`mt-4 rounded-xl border p-3 text-xs leading-relaxed ${
            ergebnis.ok
              ? 'border-emerald-900/40 bg-emerald-950/20 text-emerald-100/90'
              : 'border-red-900/40 bg-red-950/20 text-red-100/90'
          }`}
        >
          {ergebnis.ok ? (
            <>
              <p className="font-semibold">
                {ergebnis.tageImportiert} Tage · {ergebnis.tageNeu} neu · {ergebnis.tageAktualisiert}{' '}
                aktualisiert
              </p>
              {ergebnis.aeltestesDatum ? (
                <p className="mt-1 opacity-80">
                  Zeitraum: {ergebnis.aeltestesDatum} – {ergebnis.neuestesDatum}
                </p>
              ) : null}
            </>
          ) : (
            <p>{ergebnis.fehler.join(' · ')}</p>
          )}
          {ergebnis.quellen.length > 0 ? (
            <p className="mt-2 opacity-70">{ergebnis.quellen.join(' · ')}</p>
          ) : null}
          {ergebnis.hinweise.map((h) => (
            <p key={h} className="mt-1 opacity-70">
              {h}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}

'use client'

import { useCallback, useId, useState } from 'react'
import type { BesitzGebrauchtpreisErgebnis } from '@/lib/besitz-gebrauchtpreis-ki'
import { COACH_MAX_IMAGES_PER_MESSAGE } from '@/lib/ki-coach-backend'

export type BesitzGebrauchtpreisKiRow = {
  id: string
  name: string
  kategorie: string
  einkaufspreis_eur: number
  einkaufsdatum: string | null
  haendler: string | null
  hersteller: string | null
  notiz: string | null
}

function formatEur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

export function BesitzGebrauchtpreisKi({ row }: { row: BesitzGebrauchtpreisKiRow }) {
  const panelId = useId()
  const [offen, setOffen] = useState(false)
  const [dateien, setDateien] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [ergebnis, setErgebnis] = useState<BesitzGebrauchtpreisErgebnis | null>(null)
  const [grounding, setGrounding] = useState<boolean | null>(null)

  const onFiles = useCallback((list: FileList | null) => {
    if (!list?.length) {
      setDateien([])
      return
    }
    const next: File[] = []
    for (let i = 0; i < list.length && next.length < COACH_MAX_IMAGES_PER_MESSAGE; i++) {
      next.push(list[i]!)
    }
    setDateien(next)
    setErgebnis(null)
    setFehler(null)
  }, [])

  const absenden = useCallback(async () => {
    if (dateien.length === 0) {
      setFehler('Bitte mindestens ein Foto auswählen.')
      return
    }
    setBusy(true)
    setFehler(null)
    setErgebnis(null)
    setGrounding(null)
    try {
      const formData = new FormData()
      formData.append(
        'produkt',
        JSON.stringify({
          name: row.name,
          kategorie: row.kategorie,
          einkaufspreis_eur: row.einkaufspreis_eur,
          einkaufsdatum: row.einkaufsdatum,
          haendler: row.haendler,
          hersteller: row.hersteller,
          notiz: row.notiz,
        }),
      )
      for (const f of dateien) {
        formData.append('fotos', f)
      }
      const res = await fetch('/api/besitz/gebrauchtpreis', { method: 'POST', body: formData })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        ergebnis?: BesitzGebrauchtpreisErgebnis
        grounding_aktiv?: boolean
      }
      if (!res.ok || typeof data.error === 'string') {
        setFehler(data.error || 'Anfrage fehlgeschlagen.')
        return
      }
      if (data.ergebnis) {
        setErgebnis(data.ergebnis)
        setGrounding(typeof data.grounding_aktiv === 'boolean' ? data.grounding_aktiv : null)
      } else {
        setFehler('Keine nutzbare Antwort.')
      }
    } catch {
      setFehler('Netzwerkfehler.')
    } finally {
      setBusy(false)
    }
  }, [dateien, row])

  return (
    <div className="mt-3 w-full border-t border-slate-800/80 pt-3">
      <button
        type="button"
        aria-expanded={offen}
        aria-controls={panelId}
        onClick={() => setOffen((o) => !o)}
        className="rounded-lg border border-violet-600/50 bg-violet-950/35 px-3 py-1.5 text-xs font-semibold text-violet-200 transition hover:bg-violet-900/40"
      >
        {offen ? 'Gebrauchtwert (KI) ausblenden' : 'Gebrauchtwert (KI)'}
      </button>

      {offen ? (
        <div id={panelId} className="mt-3 rounded-xl border border-slate-700/80 bg-slate-950/60 p-4 text-sm text-slate-300">
          <p className="text-[12px] leading-relaxed text-slate-400">
            Fotos vom <strong className="font-medium text-slate-300">aktuellen Zustand</strong> hochladen — die KI schätzt eine
            typische <strong className="font-medium text-slate-300">Gebraucht-Verkaufsspanne</strong> (privat, DE) und berücksichtigt
            Stammdaten. Bei Gemini kann optional eine Websuche die Marktlage stützen.{' '}
            <span className="text-slate-500">Keine rechtsverbindliche Bewertung.</span>
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-600 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800/50">
              Fotos wählen (max. {COACH_MAX_IMAGES_PER_MESSAGE})
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                multiple
                className="hidden"
                onChange={(e) => onFiles(e.target.files)}
              />
            </label>
            {dateien.length > 0 ? (
              <span className="text-[11px] text-slate-500">
                {dateien.length} Datei{dateien.length === 1 ? '' : 'en'}: {dateien.map((f) => f.name).join(', ')}
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || dateien.length === 0}
              onClick={() => void absenden()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-violet-950/30 transition hover:bg-violet-500 disabled:opacity-40"
            >
              {busy ? '…' : 'Preis schätzen'}
            </button>
          </div>

          {fehler ? <p className="mt-3 text-[12px] text-rose-300">{fehler}</p> : null}

          {grounding === true ? (
            <p className="mt-2 text-[11px] text-slate-500">Hinweis: Websuche (Google) zur Markteinordnung war aktiv.</p>
          ) : grounding === false ? (
            <p className="mt-2 text-[11px] text-slate-500">Hinweis: Schätzung ohne Live-Websuche (Modellwissen / Fallback).</p>
          ) : null}

          {ergebnis ? (
            <div className="mt-4 space-y-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-[13px]">
              <p className="text-lg font-bold tabular-nums text-emerald-200/95">
                {formatEur(ergebnis.preis_wahrscheinlich_eur)}{' '}
                <span className="text-sm font-normal text-slate-400">
                  ({formatEur(ergebnis.preis_min_eur)} – {formatEur(ergebnis.preis_max_eur)})
                </span>
              </p>
              <p>
                <span className="text-slate-500">Zustand:</span>{' '}
                <span className="font-medium text-slate-200">{ergebnis.zustand_stufe}</span> — {ergebnis.zustand_kurz}
              </p>
              <p>
                <span className="text-slate-500">Markt:</span> {ergebnis.markt_einordnung}
              </p>
              <p>
                <span className="text-slate-500">Begründung:</span> {ergebnis.begruendung}
              </p>
              {ergebnis.unsicherheiten.length > 0 ? (
                <div>
                  <p className="text-slate-500">Unsicherheiten</p>
                  <ul className="mt-1 list-inside list-disc text-[12px] text-slate-400">
                    {ergebnis.unsicherheiten.map((u, i) => (
                      <li key={i}>{u}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="text-[11px] text-slate-500">{ergebnis.hinweis_rechtlich}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

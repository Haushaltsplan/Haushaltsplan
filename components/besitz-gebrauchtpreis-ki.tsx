'use client'

import { createContext, useCallback, useContext, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import type { BesitzGebrauchtpreisErgebnis } from '@/lib/besitz-gebrauchtpreis-ki'
import { KiSparklesIcon } from '@/components/ki-brand'
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

type Ctx = {
  row: BesitzGebrauchtpreisKiRow
  offen: boolean
  setOffen: (v: boolean) => void
  panelDomId: string
}

const BesitzGebrauchtpreisKiContext = createContext<Ctx | null>(null)

function useBesitzGebrauchtpreisKi(): Ctx {
  const c = useContext(BesitzGebrauchtpreisKiContext)
  if (!c) throw new Error('BesitzGebrauchtpreisKi* nur innerhalb von BesitzGebrauchtpreisKiRoot')
  return c
}

function mergeFotosListe(bisher: File[], neu: FileList | null): File[] {
  if (!neu?.length) return bisher
  const cap = COACH_MAX_IMAGES_PER_MESSAGE
  const out = [...bisher]
  for (let i = 0; i < neu.length && out.length < cap; i++) {
    out.push(neu[i]!)
  }
  return out
}

function formatEur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

export function BesitzGebrauchtpreisKiRoot({ row, children }: { row: BesitzGebrauchtpreisKiRow; children: ReactNode }) {
  const [offen, setOffen] = useState(false)
  const panelDomId = useId()
  const value = useMemo(() => ({ row, offen, setOffen, panelDomId }), [row, offen, panelDomId])
  return <BesitzGebrauchtpreisKiContext.Provider value={value}>{children}</BesitzGebrauchtpreisKiContext.Provider>
}

export function BesitzGebrauchtpreisKiToggle() {
  const { offen, setOffen, panelDomId } = useBesitzGebrauchtpreisKi()
  return (
    <button
      type="button"
      aria-expanded={offen}
      aria-controls={panelDomId}
      title={offen ? 'Gebrauchtwert ausblenden' : 'Gebrauchtwert (KI)'}
      onClick={() => setOffen(!offen)}
      className={`inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border text-violet-200 transition ${
        offen
          ? 'border-violet-400 bg-violet-900/50 ring-1 ring-violet-500/30'
          : 'border-violet-600/50 bg-violet-950/35 hover:bg-violet-900/40'
      }`}
    >
      <span className="sr-only">Gebrauchtwert per KI schätzen</span>
      <KiSparklesIcon size={18} className="shrink-0 opacity-95" />
    </button>
  )
}

/** Muss nach der Hauptzeile stehen; volle Breite, kein Overlay. */
export function BesitzGebrauchtpreisKiPanel() {
  const { row, offen, setOffen, panelDomId } = useBesitzGebrauchtpreisKi()
  const [dateien, setDateien] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [ergebnis, setErgebnis] = useState<BesitzGebrauchtpreisErgebnis | null>(null)
  const galerieRef = useRef<HTMLInputElement>(null)
  const kameraRef = useRef<HTMLInputElement>(null)

  const hinzufuegenFotos = useCallback((list: FileList | null) => {
    if (!list?.length) return
    setDateien((d) => mergeFotosListe(d, list))
    setErgebnis(null)
    setFehler(null)
  }, [])

  const alleFotosLeeren = useCallback(() => {
    setDateien([])
    setErgebnis(null)
    setFehler(null)
  }, [])

  const absenden = useCallback(async () => {
    if (dateien.length === 0) {
      setFehler('Mindestens ein Foto wählen.')
      return
    }
    setBusy(true)
    setFehler(null)
    setErgebnis(null)
    try {
      const formData = new FormData()
      formData.append(
        'produkt',
        JSON.stringify({
          name: row.name,
          kategorie: row.kategorie,
          einkaufspreis_eur: Number(row.einkaufspreis_eur),
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
      }
      if (!res.ok || typeof data.error === 'string') {
        setFehler(data.error || 'Anfrage fehlgeschlagen.')
        return
      }
      if (data.ergebnis) {
        setErgebnis(data.ergebnis)
      } else {
        setFehler('Keine nutzbare Antwort.')
      }
    } catch {
      setFehler('Netzwerkfehler.')
    } finally {
      setBusy(false)
    }
  }, [dateien, row])

  if (!offen) return null

  return (
    <div
      id={panelDomId}
      className="w-full min-w-0 border-t border-slate-800/90 pt-3 mt-1"
    >
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800/90 bg-slate-950/70 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            ref={kameraRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              hinzufuegenFotos(e.target.files)
              e.target.value = ''
            }}
          />
          <input
            ref={galerieRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
            multiple
            className="hidden"
            onChange={(e) => {
              hinzufuegenFotos(e.target.files)
              e.target.value = ''
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || dateien.length >= COACH_MAX_IMAGES_PER_MESSAGE}
              onClick={() => kameraRef.current?.click()}
              className="rounded-lg border border-sky-600/55 bg-sky-950/40 px-3 py-2 text-[11px] font-bold text-sky-100 transition hover:bg-sky-900/40 disabled:opacity-40"
            >
              Foto aufnehmen
            </button>
            <button
              type="button"
              disabled={busy || dateien.length >= COACH_MAX_IMAGES_PER_MESSAGE}
              onClick={() => galerieRef.current?.click()}
              className="rounded-lg border border-violet-600/55 bg-violet-950/40 px-3 py-2 text-[11px] font-bold text-violet-100 transition hover:bg-violet-900/40 disabled:opacity-40"
            >
              Aus Galerie
            </button>
            {dateien.length > 0 ? (
              <button
                type="button"
                disabled={busy}
                onClick={alleFotosLeeren}
                className="rounded-lg border border-slate-600 px-3 py-2 text-[11px] font-semibold text-slate-400 transition hover:bg-slate-800/80 disabled:opacity-40"
              >
                Fotos leeren
              </button>
            ) : null}
          </div>
          {dateien.length > 0 ? (
            <p className="min-w-0 truncate text-[11px] text-slate-500" title={dateien.map((f) => f.name || f.type).join(', ')}>
              {dateien.length}/{COACH_MAX_IMAGES_PER_MESSAGE}: {dateien.map((f) => f.name || '(Kamera)').join(', ')}
            </p>
          ) : (
            <p className="text-[11px] text-slate-500">Bis zu {COACH_MAX_IMAGES_PER_MESSAGE} Bilder — Kamera oder Galerie.</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <button
            type="button"
            disabled={busy || dateien.length === 0}
            onClick={() => void absenden()}
            className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white shadow-md shadow-violet-950/30 transition hover:bg-violet-500 disabled:opacity-40"
          >
            {busy ? '…' : 'Schätzen'}
          </button>
          <button
            type="button"
            onClick={() => {
              setOffen(false)
              setDateien([])
              setErgebnis(null)
              setFehler(null)
            }}
            className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-slate-800/80"
          >
            Schließen
          </button>
        </div>
      </div>

      {fehler ? <p className="mt-2 text-[12px] text-rose-300">{fehler}</p> : null}

      {ergebnis ? (
        <div className="mt-3 space-y-2.5 rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 text-[13px] text-slate-300">
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
            <ul className="list-inside list-disc text-[12px] text-slate-400">
              {ergebnis.unsicherheiten.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
          ) : null}
          <p className="text-[11px] text-slate-500">{ergebnis.hinweis_rechtlich}</p>
        </div>
      ) : null}
    </div>
  )
}

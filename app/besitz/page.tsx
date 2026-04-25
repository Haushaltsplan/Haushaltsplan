'use client'

import { BESITZ_KATEGORIEN, normalisiereBesitzKategorie } from '@/lib/besitz-kategorien'
import type { BesitzPdfPosition } from '@/lib/besitz-pdf-import'
import { supabase } from '@/lib/supabase'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

type BesitzRow = {
  id: string
  name: string
  kategorie: string
  einkaufspreis_eur: number
  einkaufsdatum: string | null
  haendler: string | null
  hersteller: string | null
  notiz: string | null
  erstellt_am: string
}

function formatEur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function parseDeZahl(s: string): number {
  return Number(String(s).trim().replace(',', '.'))
}

function formatDatumDe(iso: string | null | undefined): string {
  if (!iso) return '—'
  const head = String(iso).slice(0, 10)
  const m = head.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  return `${m[3]}.${m[2]}.${m[1]}`
}

function heuteIsoDatum() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function BesitzPage() {
  const [zeilen, setZeilen] = useState<BesitzRow[]>([])
  const [laden, setLaden] = useState(true)
  const [schemaFehlt, setSchemaFehlt] = useState(false)
  const [bearbeitenId, setBearbeitenId] = useState<string | null>(null)
  const [speichernBusy, setSpeichernBusy] = useState(false)

  const [name, setName] = useState('')
  const [kategorie, setKategorie] = useState<string>('Kleidung')
  const [preisStr, setPreisStr] = useState('')
  const [einkaufsdatum, setEinkaufsdatum] = useState('')
  const [haendler, setHaendler] = useState('')
  const [hersteller, setHersteller] = useState('')
  const [notiz, setNotiz] = useState('')

  const [filterKat, setFilterKat] = useState<string>('')
  const [suche, setSuche] = useState('')
  const [sort, setSort] = useState<'name' | 'preis' | 'datum'>('name')

  const [pdfLaden, setPdfLaden] = useState(false)
  const [pdfUebernehmenBusy, setPdfUebernehmenBusy] = useState(false)
  const [pdfVorschau, setPdfVorschau] = useState<null | {
    dateiname: string
    hinweis?: string
    positionen: BesitzPdfPosition[]
    auswahl: boolean[]
  }>(null)

  const leereFormular = useCallback(() => {
    setBearbeitenId(null)
    setName('')
    setKategorie('Kleidung')
    setPreisStr('')
    setEinkaufsdatum('')
    setHaendler('')
    setHersteller('')
    setNotiz('')
  }, [])

  const lade = useCallback(async () => {
    setLaden(true)
    setSchemaFehlt(false)
    try {
      const { data, error } = await supabase
        .from('besitz_gegenstand')
        .select('id, name, kategorie, einkaufspreis_eur, einkaufsdatum, haendler, hersteller, notiz, erstellt_am')
        .order('erstellt_am', { ascending: false })
      if (error) {
        const msg = error.message || ''
        if (msg.includes('besitz_gegenstand') || (error as { code?: string }).code === 'PGRST205') {
          setSchemaFehlt(true)
          setZeilen([])
          return
        }
        toast.error(msg || 'Liste konnte nicht geladen werden.')
        setZeilen([])
        return
      }
      setZeilen((data || []) as BesitzRow[])
    } finally {
      setLaden(false)
    }
  }, [])

  useEffect(() => {
    void lade()
  }, [lade])

  const gefiltert = useMemo(() => {
    let r = [...zeilen]
    if (filterKat) {
      r = r.filter((z) => normalisiereBesitzKategorie(z.kategorie) === filterKat)
    }
    const q = suche.trim().toLowerCase()
    if (q) {
      r = r.filter((z) => {
        const blob = `${z.name} ${z.haendler ?? ''} ${z.hersteller ?? ''} ${z.notiz ?? ''}`.toLowerCase()
        return blob.includes(q)
      })
    }
    r.sort((a, b) => {
      if (sort === 'preis') {
        return b.einkaufspreis_eur - a.einkaufspreis_eur
      }
      if (sort === 'datum') {
        const da = a.einkaufsdatum || a.erstellt_am
        const db = b.einkaufsdatum || b.erstellt_am
        return db.localeCompare(da)
      }
      return a.name.localeCompare(b.name, 'de', { sensitivity: 'base' })
    })
    return r
  }, [zeilen, filterKat, suche, sort])

  const summeGefiltert = useMemo(
    () => Math.round(gefiltert.reduce((s, z) => s + Number(z.einkaufspreis_eur || 0), 0) * 100) / 100,
    [gefiltert],
  )

  const summeGesamt = useMemo(
    () => Math.round(zeilen.reduce((s, z) => s + Number(z.einkaufspreis_eur || 0), 0) * 100) / 100,
    [zeilen],
  )

  function starteBearbeiten(z: BesitzRow) {
    setBearbeitenId(z.id)
    setName(z.name)
    setKategorie(normalisiereBesitzKategorie(z.kategorie))
    setPreisStr(String(Number(z.einkaufspreis_eur).toFixed(2)).replace('.', ','))
    setEinkaufsdatum(z.einkaufsdatum ? String(z.einkaufsdatum).slice(0, 10) : '')
    setHaendler(z.haendler ?? '')
    setHersteller(z.hersteller ?? '')
    setNotiz(z.notiz ?? '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function speichern() {
    const n = name.trim()
    if (!n) {
      toast.error('Bezeichnung eingeben.')
      return
    }
    const preis = parseDeZahl(preisStr)
    if (!Number.isFinite(preis) || preis < 0) {
      toast.error('Gültigen Einkaufspreis (EUR) eingeben.')
      return
    }
    const kat = normalisiereBesitzKategorie(kategorie)
    const datum = einkaufsdatum.trim() ? einkaufsdatum.trim() : null
    const h = haendler.trim() || null
    const marke = hersteller.trim() || null
    const nz = notiz.trim() || null

    setSpeichernBusy(true)
    try {
      if (bearbeitenId) {
        const { error } = await supabase
          .from('besitz_gegenstand')
          .update({
            name: n,
            kategorie: kat,
            einkaufspreis_eur: Math.round(preis * 100) / 100,
            einkaufsdatum: datum,
            haendler: h,
            hersteller: marke,
            notiz: nz,
          })
          .eq('id', bearbeitenId)
        if (error) {
          toast.error(error.message || 'Speichern fehlgeschlagen.')
          return
        }
        toast.success('Eintrag aktualisiert.')
      } else {
        const { error } = await supabase.from('besitz_gegenstand').insert({
          name: n,
          kategorie: kat,
          einkaufspreis_eur: Math.round(preis * 100) / 100,
          einkaufsdatum: datum,
          haendler: h,
          hersteller: marke,
          notiz: nz,
        })
        if (error) {
          toast.error(error.message || 'Anlegen fehlgeschlagen.')
          return
        }
        toast.success('Gegenstand gespeichert.')
      }
      leereFormular()
      await lade()
    } finally {
      setSpeichernBusy(false)
    }
  }

  async function loeschen(id: string) {
    if (!window.confirm('Diesen Eintrag wirklich löschen?')) return
    const { error } = await supabase.from('besitz_gegenstand').delete().eq('id', id)
    if (error) {
      toast.error(error.message || 'Löschen fehlgeschlagen.')
      return
    }
    toast.success('Gelöscht.')
    if (bearbeitenId === id) leereFormular()
    await lade()
  }

  async function handlePdfImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Bitte eine PDF-Datei hochladen.')
      return
    }
    setPdfLaden(true)
    setPdfVorschau(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/besitz/pdf-import', { method: 'POST', body: formData })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        positionen?: BesitzPdfPosition[]
        dateiname?: string
        hinweis?: string
      }
      if (!res.ok || typeof data.error === 'string') {
        toast.error(data.error || 'PDF konnte nicht ausgewertet werden.')
        return
      }
      const positionen = Array.isArray(data.positionen) ? data.positionen : []
      if (!positionen.length) {
        toast.error(data.hinweis || 'Keine Positionen erkannt.')
        return
      }
      setPdfVorschau({
        dateiname: typeof data.dateiname === 'string' ? data.dateiname : file.name,
        hinweis: typeof data.hinweis === 'string' ? data.hinweis : undefined,
        positionen,
        auswahl: positionen.map(() => true),
      })
      toast.success(`${positionen.length} erkannt`)
    } catch {
      toast.error('Netzwerkfehler beim PDF-Import.')
    } finally {
      setPdfLaden(false)
    }
  }

  function pdfToggleZeile(index: number) {
    setPdfVorschau((v) => {
      if (!v) return v
      const auswahl = v.auswahl.map((b, i) => (i === index ? !b : b))
      return { ...v, auswahl }
    })
  }

  function pdfAlleAn(ab: boolean) {
    setPdfVorschau((v) => (v ? { ...v, auswahl: v.positionen.map(() => ab) } : v))
  }

  async function uebernimmPdfVorschau() {
    if (!pdfVorschau) return
    const rows = pdfVorschau.positionen.filter((_, i) => pdfVorschau.auswahl[i])
    if (!rows.length) {
      toast.error('Mindestens eine Zeile auswählen.')
      return
    }
    setPdfUebernehmenBusy(true)
    try {
      const { error } = await supabase.from('besitz_gegenstand').insert(
        rows.map((p) => ({
          name: p.name,
          kategorie: p.kategorie,
          einkaufspreis_eur: p.einkaufspreis_eur,
          einkaufsdatum: p.einkaufsdatum,
          haendler: p.haendler,
          hersteller: p.hersteller,
          notiz: p.notiz,
        })),
      )
      if (error) {
        toast.error(error.message || 'Speichern fehlgeschlagen.')
        return
      }
      toast.success(rows.length === 1 ? '1 Gegenstand angelegt.' : `${rows.length} Gegenstände angelegt.`)
      setPdfVorschau(null)
      await lade()
    } finally {
      setPdfUebernehmenBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 pb-16 pt-6 animate-in fade-in duration-500 md:px-6">
      <div className="rounded-[2rem] border border-amber-800/40 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-xl shadow-black/35 sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-400/90">Besitz</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-100 sm:text-3xl">Gegenstände &amp; Einkaufspreise</h1>
        <p className="mt-2 max-w-xl text-xs text-slate-500">
          Manuell eintragen oder <strong className="font-medium text-slate-400">Beleg-PDF</strong> importieren (Vorschau prüfen).
        </p>
        {!laden && !schemaFehlt && zeilen.length > 0 && (
          <p className="mt-4 text-sm text-slate-400">
            Gesamtwert <span className="font-bold text-amber-200/95">{formatEur(summeGesamt)}</span>
            {gefiltert.length !== zeilen.length ? (
              <span className="text-slate-500"> · gefiltert {formatEur(summeGefiltert)}</span>
            ) : null}
          </p>
        )}
      </div>

      {schemaFehlt && (
        <div className="rounded-2xl border border-amber-700/50 bg-amber-950/30 p-4 text-sm text-amber-100">
          <p className="font-bold text-amber-200">Tabelle „besitz_gegenstand“ fehlt</p>
          <p className="mt-1.5 text-xs text-amber-100/90">
            Migration in Supabase:{' '}
            <code className="rounded bg-slate-950 px-1.5 py-0.5 text-[11px] text-slate-300">
              supabase/migrations/20260426120000_besitz_gegenstand.sql
            </code>
          </p>
        </div>
      )}

      {!schemaFehlt && (
        <>
          <div className="rounded-[2rem] border border-slate-800/90 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-xl shadow-black/30 sm:p-8">
            <h2 className="text-lg font-bold text-slate-100">{bearbeitenId ? 'Eintrag bearbeiten' : 'Neuer Gegenstand'}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Bezeichnung</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z. B. Jacke, Kopfhörer"
                  className="w-full rounded-xl border border-slate-700/90 bg-slate-950/90 px-4 py-3 text-[15px] text-slate-100 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-500/25"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Kategorie</label>
                <select
                  value={kategorie}
                  onChange={(e) => setKategorie(e.target.value)}
                  className="w-full rounded-xl border border-slate-700/90 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-500/25"
                >
                  {BESITZ_KATEGORIEN.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Einkaufspreis (EUR)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={preisStr}
                  onChange={(e) => setPreisStr(e.target.value)}
                  placeholder="0,00"
                  className="w-full rounded-xl border border-slate-700/90 bg-slate-950/90 px-4 py-3 text-lg font-semibold tabular-nums text-slate-100 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-500/25"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Kaufdatum (optional)</label>
                <input
                  type="date"
                  value={einkaufsdatum}
                  onChange={(e) => setEinkaufsdatum(e.target.value)}
                  max={heuteIsoDatum()}
                  className="w-full rounded-xl border border-slate-700/90 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-500/25"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Händler / Shop (optional)</label>
                <input
                  type="text"
                  value={haendler}
                  onChange={(e) => setHaendler(e.target.value)}
                  placeholder="Shop (optional)"
                  className="w-full rounded-xl border border-slate-700/90 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-500/25"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Hersteller / Marke (optional)</label>
                <input
                  type="text"
                  value={hersteller}
                  onChange={(e) => setHersteller(e.target.value)}
                  placeholder="Marke (optional)"
                  className="w-full rounded-xl border border-slate-700/90 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-500/25"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Notiz (optional)</label>
                <input
                  type="text"
                  value={notiz}
                  onChange={(e) => setNotiz(e.target.value)}
                  className="w-full rounded-xl border border-slate-700/90 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-500/25"
                />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={speichernBusy}
                onClick={() => void speichern()}
                className="rounded-xl bg-amber-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-amber-950/30 transition hover:bg-amber-500 disabled:opacity-40"
              >
                {speichernBusy ? '…' : bearbeitenId ? 'Änderungen speichern' : 'Hinzufügen'}
              </button>
              {bearbeitenId ? (
                <button
                  type="button"
                  disabled={speichernBusy}
                  onClick={leereFormular}
                  className="rounded-xl border border-slate-600 bg-slate-950 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
                >
                  Abbrechen
                </button>
              ) : null}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-800/90 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-xl shadow-black/30 sm:p-8">
            <h2 className="text-lg font-bold text-slate-100">Beleg-PDF (KI)</h2>
            <p className="mt-1.5 text-xs text-slate-500">
              Text-PDFs werden lokal eingelesen, Scans per Gemini (<code className="rounded bg-slate-900 px-1 font-mono text-[10px] text-slate-400">GEMINI_API_KEY</code>).
            </p>
            <div className="mt-4">
              <label
                htmlFor="besitz-pdf-import"
                className={`inline-flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed px-5 py-3.5 text-sm font-semibold transition-colors ${
                  pdfLaden ? 'cursor-not-allowed border-slate-700 text-slate-600' : 'border-amber-700/55 text-amber-200/95 hover:bg-amber-950/25'
                }`}
              >
                {pdfLaden ? 'PDF wird ausgewertet…' : 'PDF auswählen …'}
              </label>
              <input
                id="besitz-pdf-import"
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                disabled={pdfLaden}
                onChange={(e) => void handlePdfImport(e)}
              />
            </div>
            {pdfVorschau ? (
              <div className="mt-6 rounded-xl border border-slate-700/80 bg-slate-950/50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-slate-200">
                    Vorschau: <span className="font-mono text-xs text-slate-400">{pdfVorschau.dateiname}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => pdfAlleAn(true)}
                      className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                    >
                      Alle an
                    </button>
                    <button
                      type="button"
                      onClick={() => pdfAlleAn(false)}
                      className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                    >
                      Alle aus
                    </button>
                  </div>
                </div>
                {pdfVorschau.hinweis ? <p className="mt-2 text-[12px] text-slate-500">{pdfVorschau.hinweis}</p> : null}
                <ul className="mt-4 max-h-[min(24rem,55vh)] space-y-2 overflow-y-auto pr-1">
                  {pdfVorschau.positionen.map((p, i) => (
                    <li key={`${p.name}-${i}`}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800/90 bg-slate-900/60 p-3 hover:bg-slate-800/40">
                        <input
                          type="checkbox"
                          checked={pdfVorschau.auswahl[i]}
                          onChange={() => pdfToggleZeile(i)}
                          className="mt-1 h-4 w-4 shrink-0 rounded border-slate-600 accent-amber-500"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-100">{p.name}</p>
                          <p className="mt-0.5 text-xs text-amber-200/90">{p.kategorie}</p>
                          {p.haendler ? <p className="mt-0.5 text-xs text-slate-500">{p.haendler}</p> : null}
                          {p.hersteller ? (
                            <p className="mt-0.5 text-xs text-slate-400">Hersteller: {p.hersteller}</p>
                          ) : null}
                          {p.notiz ? <p className="mt-1 text-[12px] text-slate-500">{p.notiz}</p> : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-bold tabular-nums text-amber-200">{formatEur(p.einkaufspreis_eur)}</p>
                          <p className="text-[10px] text-slate-500">{formatDatumDe(p.einkaufsdatum)}</p>
                        </div>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pdfUebernehmenBusy}
                    onClick={() => void uebernimmPdfVorschau()}
                    className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-amber-950/30 transition hover:bg-amber-500 disabled:opacity-40"
                  >
                    {pdfUebernehmenBusy ? '…' : 'Markierte in Besitz übernehmen'}
                  </button>
                  <button
                    type="button"
                    disabled={pdfUebernehmenBusy}
                    onClick={() => setPdfVorschau(null)}
                    className="rounded-xl border border-slate-600 bg-slate-950 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
                  >
                    Vorschau verwerfen
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-[2rem] border border-slate-800/90 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-xl shadow-black/30 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-slate-100">Liste</h2>
                <p className="mt-1 text-[12px] text-slate-500">{laden ? 'Lade …' : `${gefiltert.length} von ${zeilen.length} Einträgen`}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filterKat}
                  onChange={(e) => setFilterKat(e.target.value)}
                  className="rounded-xl border border-slate-700/90 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 outline-none focus:ring-2 focus:ring-amber-500/30"
                >
                  <option value="">Alle Kategorien</option>
                  {BESITZ_KATEGORIEN.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as 'name' | 'preis' | 'datum')}
                  className="rounded-xl border border-slate-700/90 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 outline-none focus:ring-2 focus:ring-amber-500/30"
                >
                  <option value="name">Sortierung: Name</option>
                  <option value="preis">Sortierung: Preis (hoch)</option>
                  <option value="datum">Sortierung: Datum</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <input
                type="search"
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                placeholder="Suchen …"
                className="w-full rounded-xl border border-slate-700/90 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-500/25"
              />
            </div>

            {laden ? (
              <p className="mt-10 py-12 text-center text-slate-500">Lade Einträge …</p>
            ) : zeilen.length === 0 ? (
              <p className="mt-10 py-12 text-center text-slate-500">Noch leer — oben anlegen.</p>
            ) : gefiltert.length === 0 ? (
              <p className="mt-10 py-12 text-center text-slate-500">Keine Treffer für Filter oder Suche.</p>
            ) : (
              <ul className="mt-6 divide-y divide-slate-800/80">
                {gefiltert.map((z) => (
                  <li key={z.id} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg border border-amber-800/50 bg-amber-950/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200/95">
                          {normalisiereBesitzKategorie(z.kategorie)}
                        </span>
                        <span className="text-[11px] tabular-nums text-slate-500">{formatDatumDe(z.einkaufsdatum)}</span>
                      </div>
                      <p className="mt-1.5 text-base font-semibold text-slate-100">{z.name}</p>
                      {z.hersteller ? (
                        <p className="mt-0.5 text-sm text-slate-300">
                          <span className="text-slate-500">Hersteller:</span> {z.hersteller}
                        </p>
                      ) : null}
                      {z.haendler ? <p className="mt-0.5 text-sm text-slate-400">{z.haendler}</p> : null}
                      {z.notiz ? <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{z.notiz}</p> : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                      <span className="text-lg font-bold tabular-nums text-amber-200 sm:text-right">
                        {formatEur(Number(z.einkaufspreis_eur))}
                      </span>
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <button
                          type="button"
                          onClick={() => starteBearbeiten(z)}
                          className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/15"
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={() => void loeschen(z.id)}
                          className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-rose-300/95 transition hover:bg-rose-500/15"
                        >
                          Löschen
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}

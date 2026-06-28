'use client'

import { BESITZ_KATEGORIEN, normalisiereBesitzKategorie } from '@/lib/besitz-kategorien'
import {
  besitzArtGruppenFuerKategorie,
  besitzArtLabel,
  besitzHatFeinart,
  normalisiereBesitzKleidungsart,
} from '@/lib/besitz-kleidungsarten'
import { besitzFotoSignedUrl, loescheBesitzFoto, uploadBesitzFoto } from '@/lib/besitz-foto'
import type { BesitzPdfPosition } from '@/lib/besitz-pdf-import'
import { supabase } from '@/lib/supabase'
import {
  PageChrome,
  PageHero,
  PageSubTabs,
  pageSectionHeaderClass,
  pageSectionPanelClass,
  pageSectionShellClass,
  pageSectionTitleClass,
} from '@/components/page-shell'
import {
  appInputAmberClass,
  appLabelClass,
  appListItemClass,
  appSecondaryBtnClass,
} from '@/lib/app-ui'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  BesitzGebrauchtpreisKiPanel,
  BesitzGebrauchtpreisKiRoot,
  BesitzGebrauchtpreisKiToggle,
} from '@/components/besitz-gebrauchtpreis-ki'
import { errateBesitzArtRegeln } from '@/lib/besitz-art-erkennung'
import { BesitzAnreichernRunner } from '@/components/besitz-anreichern-runner'
import { BesitzFotoUpload } from '@/components/besitz-foto-upload'
import { BesitzKleiderschrank, type BesitzKleiderschrankRow } from '@/components/besitz-kleiderschrank'
import { KiBrandChip } from '@/components/ki-brand'

type BesitzRow = BesitzKleiderschrankRow & {
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

function istBesitzPdfDatei(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function istBesitzBelegfotoDatei(file: File): boolean {
  const n = file.name.toLowerCase()
  return (
    file.type === 'image/jpeg' ||
    file.type === 'image/png' ||
    file.type === 'image/webp' ||
    n.endsWith('.jpg') ||
    n.endsWith('.jpeg') ||
    n.endsWith('.png') ||
    n.endsWith('.webp')
  )
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
  const [kleidungsart, setKleidungsart] = useState('')
  const [groesse, setGroesse] = useState('')
  const [farbe, setFarbe] = useState('')
  const [fotoDatei, setFotoDatei] = useState<File | null>(null)
  const [fotoVorschau, setFotoVorschau] = useState<string | null>(null)
  const [bestehendBildPfad, setBestehendBildPfad] = useState<string | null>(null)
  const [fotoEntfernen, setFotoEntfernen] = useState(false)

  const [filterKat, setFilterKat] = useState<string>('')
  const [suche, setSuche] = useState('')
  const [sort, setSort] = useState<'name' | 'preis' | 'datum'>('name')
  const [ansicht, setAnsicht] = useState<'liste' | 'kleiderschrank'>('kleiderschrank')

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
    setKleidungsart('')
    setGroesse('')
    setFarbe('')
    setFotoDatei(null)
    setFotoVorschau((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return null
    })
    setBestehendBildPfad(null)
    setFotoEntfernen(false)
  }, [])

  const lade = useCallback(async () => {
    setLaden(true)
    setSchemaFehlt(false)
    try {
      const { data, error } = await supabase
        .from('besitz_gegenstand')
        .select(
          'id, name, kategorie, kleidungsart, groesse, farbe, bild_pfad, einkaufspreis_eur, einkaufsdatum, haendler, hersteller, notiz, erstellt_am',
        )
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

  const kleiderschrankZeilen = useMemo(() => {
    let r = zeilen.filter((z) => ['Kleidung', 'Schuhe'].includes(normalisiereBesitzKategorie(z.kategorie)))
    const q = suche.trim().toLowerCase()
    if (q) {
      r = r.filter((z) => {
        const blob = `${z.name} ${z.kleidungsart ?? ''} ${z.groesse ?? ''} ${z.farbe ?? ''} ${z.hersteller ?? ''} ${z.haendler ?? ''}`.toLowerCase()
        return blob.includes(q)
      })
    }
    return r
  }, [zeilen, suche])

  const summeGefiltert = useMemo(
    () => Math.round(gefiltert.reduce((s, z) => s + Number(z.einkaufspreis_eur || 0), 0) * 100) / 100,
    [gefiltert],
  )

  const summeGesamt = useMemo(
    () => Math.round(zeilen.reduce((s, z) => s + Number(z.einkaufspreis_eur || 0), 0) * 100) / 100,
    [zeilen],
  )

  const katNorm = useMemo(() => normalisiereBesitzKategorie(kategorie), [kategorie])
  const artGruppen = useMemo(() => besitzArtGruppenFuerKategorie(katNorm), [katNorm])

  function waehleFoto(file: File) {
    setFotoDatei(file)
    setFotoEntfernen(false)
    setFotoVorschau((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  function entferneFoto() {
    setFotoDatei(null)
    setFotoEntfernen(true)
    setFotoVorschau((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return null
    })
  }

  function starteBearbeiten(z: BesitzKleiderschrankRow) {
    setBearbeitenId(z.id)
    setName(z.name)
    setKategorie(normalisiereBesitzKategorie(z.kategorie))
    setPreisStr(String(Number(z.einkaufspreis_eur).toFixed(2)).replace('.', ','))
    setEinkaufsdatum(z.einkaufsdatum ? String(z.einkaufsdatum).slice(0, 10) : '')
    setHaendler(z.haendler ?? '')
    setHersteller(z.hersteller ?? '')
    setNotiz(z.notiz ?? '')
    setKleidungsart(z.kleidungsart ?? '')
    setGroesse(z.groesse ?? '')
    setFarbe(z.farbe ?? '')
    setFotoDatei(null)
    setFotoEntfernen(false)
    setBestehendBildPfad(z.bild_pfad)
    setFotoVorschau((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return null
    })
    if (z.bild_pfad) {
      void besitzFotoSignedUrl(z.bild_pfad).then((url) => {
        if (url) setFotoVorschau(url)
      })
    }
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
    const art = normalisiereBesitzKleidungsart(kleidungsart, kat)
    const groesseVal = groesse.trim() || null
    const farbeVal = farbe.trim() || null

    setSpeichernBusy(true)
    try {
      let rowId = bearbeitenId
      const basis = {
        name: n,
        kategorie: kat,
        kleidungsart: art,
        groesse: groesseVal,
        farbe: farbeVal,
        einkaufspreis_eur: Math.round(preis * 100) / 100,
        einkaufsdatum: datum,
        haendler: h,
        hersteller: marke,
        notiz: nz,
      }

      if (bearbeitenId) {
        const { error } = await supabase.from('besitz_gegenstand').update(basis).eq('id', bearbeitenId)
        if (error) {
          toast.error(error.message || 'Speichern fehlgeschlagen.')
          return
        }
        toast.success('Eintrag aktualisiert.')
      } else {
        const { data, error } = await supabase.from('besitz_gegenstand').insert(basis).select('id').single()
        if (error) {
          toast.error(error.message || 'Anlegen fehlgeschlagen.')
          return
        }
        rowId = data?.id ?? null
        toast.success('Gegenstand gespeichert.')
      }

      if (!rowId) {
        toast.error('Eintrag-ID fehlt — Foto konnte nicht verknüpft werden.')
        return
      }

      let neuerBildPfad = fotoEntfernen ? null : bestehendBildPfad

      if (fotoDatei) {
        try {
          neuerBildPfad = await uploadBesitzFoto(rowId, fotoDatei)
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Foto-Upload fehlgeschlagen.')
          await lade()
          return
        }
      } else if (fotoEntfernen && bestehendBildPfad) {
        await loescheBesitzFoto(bestehendBildPfad)
        neuerBildPfad = null
      }

      if (neuerBildPfad !== bestehendBildPfad || fotoEntfernen) {
        const { error: bildErr } = await supabase
          .from('besitz_gegenstand')
          .update({ bild_pfad: neuerBildPfad })
          .eq('id', rowId)
        if (bildErr) {
          toast.error(bildErr.message || 'Foto-Pfad konnte nicht gespeichert werden.')
        }
      }
      leereFormular()
      await lade()
    } finally {
      setSpeichernBusy(false)
    }
  }

  async function loeschen(id: string) {
    if (!window.confirm('Diesen Eintrag wirklich löschen?')) return
    const row = zeilen.find((z) => z.id === id)
    const { error } = await supabase.from('besitz_gegenstand').delete().eq('id', id)
    if (error) {
      toast.error(error.message || 'Löschen fehlgeschlagen.')
      return
    }
    if (row?.bild_pfad) await loescheBesitzFoto(row.bild_pfad)
    toast.success('Gelöscht.')
    if (bearbeitenId === id) leereFormular()
    await lade()
  }

  async function handleBelegImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const isPdf = istBesitzPdfDatei(file)
    const isFoto = istBesitzBelegfotoDatei(file)
    if (!isPdf && !isFoto) {
      toast.error('Bitte eine PDF-Datei oder ein Foto (JPEG, PNG, WebP) wählen.')
      return
    }

    setPdfLaden(true)
    setPdfVorschau(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const apiUrl = isPdf ? '/api/besitz/pdf-import' : '/api/besitz/foto-import'
      const res = await fetch(apiUrl, { method: 'POST', body: formData })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        positionen?: BesitzPdfPosition[]
        dateiname?: string
        hinweis?: string
      }
      if (!res.ok || typeof data.error === 'string') {
        toast.error(data.error || 'Beleg konnte nicht ausgewertet werden.')
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
      toast.error('Netzwerkfehler beim Beleg-Import.')
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
        rows.map((p) => {
          const kat = normalisiereBesitzKategorie(p.kategorie)
          const erraten = errateBesitzArtRegeln({
            kategorie: kat,
            name: p.name,
            hersteller: p.hersteller,
            notiz: p.notiz,
            haendler: p.haendler,
          })
          return {
            name: p.name,
            kategorie: kat,
            kleidungsart: erraten.kleidungsart,
            groesse: erraten.groesse,
            farbe: erraten.farbe,
            einkaufspreis_eur: p.einkaufspreis_eur,
            einkaufsdatum: p.einkaufsdatum,
            haendler: p.haendler,
            hersteller: p.hersteller,
            notiz: p.notiz,
          }
        }),
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
    <PageChrome>
      <PageHero
        eyebrow="Besitz"
        title="Gegenstände & Einkaufspreise"
        description={
          <>
            <p>
              Kleiderschrank mit Fotos und feinen Kategorien (T-Shirt, Jeans …) — oder manuell / per{' '}
              <strong className="font-medium text-[var(--app-text)]">Beleg-PDF</strong> importieren.
            </p>
            {!laden && !schemaFehlt && zeilen.length > 0 ? (
              <p className="mt-3 text-sm text-[var(--app-text-muted)]">
                Gesamtwert <span className="font-bold text-amber-200/95">{formatEur(summeGesamt)}</span>
                {gefiltert.length !== zeilen.length ? (
                  <span className="text-[var(--app-text-muted)]"> · gefiltert {formatEur(summeGefiltert)}</span>
                ) : null}
              </p>
            ) : null}
          </>
        }
      />

      {schemaFehlt && (
        <div className="rounded-2xl border border-amber-700/50 bg-amber-950/30 p-4 text-sm text-amber-100">
          <p className="font-bold text-amber-200">Tabelle „besitz_gegenstand“ fehlt</p>
          <p className="mt-1.5 text-xs text-amber-100/90">
            Migration in Supabase:{' '}
            <code className="rounded bg-[var(--app-surface-muted)] px-1.5 py-0.5 text-[11px] text-[var(--app-text)]">
              supabase/migrations/20260426120000_besitz_gegenstand.sql
            </code>
            {' '}und für Kleiderschrank/Fotos:{' '}
            <code className="rounded bg-[var(--app-surface-muted)] px-1.5 py-0.5 text-[11px] text-[var(--app-text)]">
              supabase/migrations/20260607120000_besitz_kleiderschrank.sql
            </code>
          </p>
        </div>
      )}

      {!schemaFehlt && (
        <>
          <section className={pageSectionShellClass}>
            <div className={pageSectionHeaderClass}>
              <h2 className={pageSectionTitleClass}>{bearbeitenId ? 'Eintrag bearbeiten' : 'Neuer Gegenstand'}</h2>
            </div>
            <div className={pageSectionPanelClass}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={`mb-1.5 block ${appLabelClass}`}>Bezeichnung</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z. B. Jacke, Kopfhörer"
                  className={appInputAmberClass}
                />
              </div>
              <div>
                <label className={`mb-1.5 block ${appLabelClass}`}>Kategorie</label>
                <select
                  value={kategorie}
                  onChange={(e) => {
                    setKategorie(e.target.value)
                    setKleidungsart('')
                  }}
                  className={`${appInputAmberClass} text-sm`}
                >
                  {BESITZ_KATEGORIEN.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              {besitzHatFeinart(katNorm) ? (
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
                    {besitzArtLabel(katNorm)}
                  </label>
                  <select
                    value={kleidungsart}
                    onChange={(e) => setKleidungsart(e.target.value)}
                    className={`${appInputAmberClass} text-sm`}
                  >
                    <option value="">— Art wählen —</option>
                    {artGruppen.map((g) => (
                      <optgroup key={g.label} label={g.label}>
                        {g.arten.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              ) : null}
              {besitzHatFeinart(katNorm) ? (
                <>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
                      Größe (optional)
                    </label>
                    <input
                      type="text"
                      value={groesse}
                      onChange={(e) => setGroesse(e.target.value)}
                      placeholder="z. B. M, 32/32, 42"
                      className={`${appInputAmberClass} text-sm`}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
                      Farbe (optional)
                    </label>
                    <input
                      type="text"
                      value={farbe}
                      onChange={(e) => setFarbe(e.target.value)}
                      placeholder="z. B. Navy, Schwarz"
                      className={`${appInputAmberClass} text-sm`}
                    />
                  </div>
                </>
              ) : null}
              <div>
                <label className={`mb-1.5 block ${appLabelClass}`}>Einkaufspreis (EUR)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={preisStr}
                  onChange={(e) => setPreisStr(e.target.value)}
                  placeholder="0,00"
                  className={`${appInputAmberClass} text-lg font-semibold tabular-nums`}
                />
              </div>
              <div>
                <label className={`mb-1.5 block ${appLabelClass}`}>Kaufdatum (optional)</label>
                <input
                  type="date"
                  value={einkaufsdatum}
                  onChange={(e) => setEinkaufsdatum(e.target.value)}
                  max={heuteIsoDatum()}
                  className={`${appInputAmberClass} text-sm`}
                />
              </div>
              <div>
                <label className={`mb-1.5 block ${appLabelClass}`}>Händler / Shop (optional)</label>
                <input
                  type="text"
                  value={haendler}
                  onChange={(e) => setHaendler(e.target.value)}
                  placeholder="Shop (optional)"
                  className={`${appInputAmberClass} text-sm`}
                />
              </div>
              <div>
                <label className={`mb-1.5 block ${appLabelClass}`}>Hersteller / Marke (optional)</label>
                <input
                  type="text"
                  value={hersteller}
                  onChange={(e) => setHersteller(e.target.value)}
                  placeholder="Marke (optional)"
                  className={`${appInputAmberClass} text-sm`}
                />
              </div>
              <div className="sm:col-span-2">
                <BesitzFotoUpload
                  previewUrl={fotoVorschau}
                  busy={speichernBusy}
                  onPick={waehleFoto}
                  onRemove={entferneFoto}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={`mb-1.5 block ${appLabelClass}`}>Notiz (optional)</label>
                <input
                  type="text"
                  value={notiz}
                  onChange={(e) => setNotiz(e.target.value)}
                  className={`${appInputAmberClass} text-sm`}
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
                  className={appSecondaryBtnClass}
                >
                  Abbrechen
                </button>
              ) : null}
            </div>
            </div>
          </section>

          <section className={pageSectionShellClass}>
            <div className={pageSectionHeaderClass}>
              <div className="flex flex-wrap items-center gap-2">
                <KiBrandChip iconSize={14} />
                <h2 className={pageSectionTitleClass}>Beleg importieren (PDF oder Foto)</h2>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[var(--app-text-muted)]">
              Text-PDFs werden lokal eingelesen; gescannte PDFs, Handy-Fotos und Bilder werden per KI ausgewertet (wie Finanz-Coach:{' '}
              <code className="rounded bg-[var(--app-surface-muted)] px-1 font-mono text-[10px] text-[var(--app-text-muted)]">GEMINI_API_KEY</code> oder{' '}
              <code className="rounded bg-[var(--app-surface-muted)] px-1 font-mono text-[10px] text-[var(--app-text-muted)]">OPENAI_API_KEY</code>
              ).
              </p>
            </div>
            <div className={pageSectionPanelClass}>
            <div className="mt-0">
              <label
                htmlFor="besitz-beleg-import"
                className={`inline-flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed px-5 py-3.5 text-sm font-semibold transition-colors ${
                  pdfLaden ? 'cursor-not-allowed border-[var(--app-border-strong)] text-[var(--app-text-muted)]' : 'border-amber-700/55 text-amber-200/95 hover:bg-amber-950/25'
                }`}
              >
                {pdfLaden ? 'Beleg wird ausgewertet…' : 'PDF oder Foto auswählen …'}
              </label>
              <input
                id="besitz-beleg-import"
                type="file"
                accept="application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                className="hidden"
                disabled={pdfLaden}
                onChange={(e) => void handleBelegImport(e)}
              />
            </div>
            {pdfVorschau ? (
              <div className="mt-6 rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-[var(--app-text)]">
                    Vorschau: <span className="font-mono text-xs text-[var(--app-text-muted)]">{pdfVorschau.dateiname}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => pdfAlleAn(true)}
                      className="rounded-lg border border-[var(--app-border-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text)] hover:bg-[var(--app-surface-hover)]"
                    >
                      Alle an
                    </button>
                    <button
                      type="button"
                      onClick={() => pdfAlleAn(false)}
                      className="rounded-lg border border-[var(--app-border-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text)] hover:bg-[var(--app-surface-hover)]"
                    >
                      Alle aus
                    </button>
                  </div>
                </div>
                {pdfVorschau.hinweis ? <p className="mt-2 text-[12px] text-[var(--app-text-muted)]">{pdfVorschau.hinweis}</p> : null}
                <ul className="mt-4 max-h-[min(24rem,55vh)] space-y-2 overflow-y-auto pr-1">
                  {pdfVorschau.positionen.map((p, i) => (
                    <li key={`${p.name}-${i}`}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3 hover:bg-[var(--app-surface-hover)]">
                        <input
                          type="checkbox"
                          checked={pdfVorschau.auswahl[i]}
                          onChange={() => pdfToggleZeile(i)}
                          className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--app-border-strong)] accent-amber-500"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[var(--app-text)]">{p.name}</p>
                          <p className="mt-0.5 text-xs text-amber-200/90">{p.kategorie}</p>
                          {p.haendler ? <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">{p.haendler}</p> : null}
                          {p.hersteller ? (
                            <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">Hersteller: {p.hersteller}</p>
                          ) : null}
                          {p.notiz ? <p className="mt-1 text-[12px] text-[var(--app-text-muted)]">{p.notiz}</p> : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-bold tabular-nums text-amber-200">{formatEur(p.einkaufspreis_eur)}</p>
                          <p className="text-[10px] text-[var(--app-text-muted)]">{formatDatumDe(p.einkaufsdatum)}</p>
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
                    className="rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-5 py-2.5 text-sm font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-surface-hover)] disabled:opacity-40"
                  >
                    Vorschau verwerfen
                  </button>
                </div>
              </div>
            ) : null}
            </div>
          </section>

          <section className={pageSectionShellClass}>
            <div className={pageSectionHeaderClass}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0 flex-1">
                <h2 className={pageSectionTitleClass}>{ansicht === 'kleiderschrank' ? 'Kleiderschrank' : 'Liste'}</h2>
                <p className="mt-1 text-[12px] text-[var(--app-text-muted)]">
                  {laden
                    ? 'Lade …'
                    : ansicht === 'kleiderschrank'
                      ? `${kleiderschrankZeilen.length} Teile`
                      : `${gefiltert.length} von ${zeilen.length} Einträgen`}
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              <PageSubTabs
                selectId="besitz-ansicht"
                ariaLabel="Besitz-Ansicht"
                className="w-full sm:w-auto"
                sticky={false}
                tabs={[
                  { id: 'kleiderschrank' as const, label: 'Kleiderschrank', accent: 'teal' },
                  { id: 'liste' as const, label: 'Liste', accent: 'teal' },
                ]}
                active={ansicht}
                onChange={setAnsicht}
              />
                {ansicht === 'liste' ? (
                  <>
                <select
                  value={filterKat}
                  onChange={(e) => setFilterKat(e.target.value)}
                  className={`${appInputAmberClass} py-2 text-xs font-semibold`}
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
                  className={`${appInputAmberClass} py-2 text-xs font-semibold`}
                >
                  <option value="name">Sortierung: Name</option>
                  <option value="preis">Sortierung: Preis (hoch)</option>
                  <option value="datum">Sortierung: Datum</option>
                </select>
                  </>
                ) : null}
              </div>
            </div>
            </div>
            <div className={pageSectionPanelClass}>
            <div className="mb-6">
              <input
                type="search"
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                placeholder={ansicht === 'kleiderschrank' ? 'Im Kleiderschrank suchen …' : 'Suchen …'}
                className={appInputAmberClass}
              />
            </div>
            {ansicht === 'kleiderschrank' ? (
              <>
              <BesitzAnreichernRunner
                zeilen={zeilen}
                laden={laden}
                autoStart={ansicht === 'kleiderschrank'}
                onFertig={lade}
              />
              <BesitzKleiderschrank
                zeilen={kleiderschrankZeilen}
                laden={laden}
                onBearbeiten={starteBearbeiten}
                onLoeschen={(id) => void loeschen(id)}
                formatEur={formatEur}
                formatDatumDe={formatDatumDe}
              />
              </>
            ) : (
              <>
            {laden ? (
              <p className="mt-10 py-12 text-center text-[var(--app-text-muted)]">Lade Einträge …</p>
            ) : zeilen.length === 0 ? (
              <p className="mt-10 py-12 text-center text-[var(--app-text-muted)]">Noch leer — oben anlegen.</p>
            ) : gefiltert.length === 0 ? (
              <p className="mt-10 py-12 text-center text-[var(--app-text-muted)]">Keine Treffer für Filter oder Suche.</p>
            ) : (
              <ul className="mt-6 divide-y divide-[var(--app-border)]">
                {gefiltert.map((z) => (
                  <li key={z.id} className="flex flex-col gap-0 py-4 first:pt-0">
                    <BesitzGebrauchtpreisKiRoot row={z}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-lg border border-amber-800/50 bg-amber-950/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200/95">
                              {normalisiereBesitzKategorie(z.kategorie)}
                            </span>
                            {z.kleidungsart ? (
                              <span className="rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--app-text)]">
                                {z.kleidungsart}
                              </span>
                            ) : null}
                            <span className="text-[11px] tabular-nums text-[var(--app-text-muted)]">{formatDatumDe(z.einkaufsdatum)}</span>
                          </div>
                          <p className="mt-1.5 text-base font-semibold text-[var(--app-text)]">{z.name}</p>
                          {(z.groesse || z.farbe) ? (
                            <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
                              {[z.groesse, z.farbe].filter(Boolean).join(' · ')}
                            </p>
                          ) : null}
                          {z.hersteller ? (
                            <p className="mt-0.5 text-sm text-[var(--app-text)]">
                              <span className="text-[var(--app-text-muted)]">Hersteller:</span> {z.hersteller}
                            </p>
                          ) : null}
                          {z.haendler ? <p className="mt-0.5 text-sm text-[var(--app-text-muted)]">{z.haendler}</p> : null}
                          {z.notiz ? <p className="mt-1 text-[13px] leading-relaxed text-[var(--app-text-muted)]">{z.notiz}</p> : null}
                        </div>
                        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                          <span className="text-lg font-bold tabular-nums text-amber-200 sm:text-right">
                            {formatEur(Number(z.einkaufspreis_eur))}
                          </span>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => starteBearbeiten(z)}
                              className="rounded-lg border border-[var(--app-border-strong)] px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/15"
                            >
                              Bearbeiten
                            </button>
                            <button
                              type="button"
                              onClick={() => void loeschen(z.id)}
                              className="rounded-lg border border-[var(--app-border-strong)] px-3 py-1.5 text-xs font-semibold text-rose-300/95 transition hover:bg-rose-500/15"
                            >
                              Löschen
                            </button>
                            <BesitzGebrauchtpreisKiToggle />
                          </div>
                        </div>
                      </div>
                      <BesitzGebrauchtpreisKiPanel />
                    </BesitzGebrauchtpreisKiRoot>
                  </li>
                ))}
              </ul>
            )}
              </>
            )}
            </div>
          </section>
        </>
      )}
    </PageChrome>
  )
}

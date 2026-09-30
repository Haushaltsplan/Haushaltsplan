'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { appTableScrollClassName } from '@/components/page-shell'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard, PA_SCROLL_ELEGANT, PA_TABLE_COMPACT, PA_TABLE_FRAME } from '@/components/portfolio-analyse/pa-ui'
import { CLIENT_STATE_APPLIED_EVENT, CLIENT_STATE_KEYS } from '@/lib/client-state/client-state-keys'
import { fundamentaldatenHref } from '@/lib/portfolio-analyse/fundamentaldaten-navigation'
import {
  aktiveFilterChips,
  filterGleich,
  hatAktiveFilterAusserSuche,
  kloneFilter,
  leerScreenerFilter,
  passtScreenerFilter,
  setzeSpanne,
  sortiereScreenerZeilen,
  sortierungIstAufsteigendDefault,
  zaehleMantraTreffer,
} from '@/lib/portfolio-analyse/screener/screener-filter'
import {
  SCREENER_SCHEMA_VERSION,
  type ScreenerEigeneVorlage,
  type ScreenerFilter,
  type ScreenerKennzahl,
  type ScreenerSort,
  type ScreenerZeile,
} from '@/lib/portfolio-analyse/screener/screener-types'
import {
  bewerteQualityCompounder,
  qualityCompounderScore,
  qualityVerfehlungen,
} from '@/lib/portfolio-analyse/screener/screener-quality-compounder'
import {
  benenneScreenerVorlageUm,
  leseScreenerVorlagen,
  loescheScreenerVorlage,
  SCREENER_VORLAGEN_EVENT,
  speichereScreenerVorlage,
} from '@/lib/portfolio-analyse/screener/screener-vorlagen-store'
import {
  findeWatchlistIdx,
  fuegeZurWatchlistHinzu,
  ladeWatchlist,
  WATCHLIST_CHANGED_EVENT,
} from '@/lib/portfolio-analyse/watchlist-client'

type ApiAntwort = {
  ok: boolean
  leer?: boolean
  periode?: string | null
  aktualisiertAm?: string | null
  n?: number
  schemaVersion?: number
  zeilen?: ScreenerZeile[]
  cloudGespeichert?: boolean
  cloudWarnung?: string | null
  message?: string
}

type SpalteId =
  | 'ticker'
  | 'name'
  | 'boerse'
  | 'jahre'
  | 'umsatz'
  | 'cagr5'
  | 'wachstum'
  | 'niMarge'
  | 'roe'
  | 'roic'
  | 'fcfMarge'
  | 'conv'
  | 'verw'
  | 'ndEbitda'
  | 'kgv'
  | 'kuv'
  | 'kbv'
  | 'mantra'
  | 'quality'
  | 'iroic'
  | 'brutto'
  | 'reinvest'
  | 'zins'
  | 'sbcOcf'
  | 'kurs'
  | 'watch'

type FilterTabId = 'universum' | 'profit' | 'wachstum' | 'cash' | 'bilanz' | 'bewertung' | 'spalten'

const SPALTEN_KEY = 'pa-screener-spalten-v3'
const INPUT =
  'w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-1 text-sm text-[var(--app-text)]'
const CHIP =
  'rounded-md border px-2.5 py-1 text-[11px] font-medium transition'
const CHIP_AN = 'border-teal-400/70 bg-teal-500/20 text-teal-100'
const CHIP_AUS = 'border-[var(--app-border)] text-[var(--app-text-muted)] hover:border-teal-500/40'
const CHIP_TWEAK = 'border-amber-400/60 bg-amber-500/15 text-amber-100'
const BTN =
  'rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs text-[var(--app-text)] transition hover:border-teal-500/40 disabled:opacity-50'
const BTN_PRIM =
  'rounded-md border border-teal-500/40 bg-teal-500/15 px-3 py-1.5 text-xs text-teal-100 transition hover:bg-teal-500/25 disabled:opacity-50'
const BTN_WARN =
  'rounded-md border border-amber-500/40 bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-amber-500/30 disabled:opacity-50'

const SPALTEN: {
  id: SpalteId
  label: string
  sort?: ScreenerSort
  defaultOn: boolean
  immer?: boolean
}[] = [
  { id: 'ticker', label: 'Ticker', sort: 'ticker', defaultOn: true, immer: true },
  { id: 'name', label: 'Name', sort: 'name', defaultOn: true },
  { id: 'boerse', label: 'Börse', defaultOn: false },
  { id: 'jahre', label: 'Jahre', sort: 'jahreAnzahl', defaultOn: true },
  { id: 'umsatz', label: 'Umsatz', sort: 'umsatzMio', defaultOn: true },
  { id: 'cagr5', label: 'CAGR 5J', sort: 'umsatzCagr5y', defaultOn: true },
  { id: 'wachstum', label: 'Umsatz 1J', sort: 'umsatzWachstumPct', defaultOn: false },
  { id: 'niMarge', label: 'NI-Marge', sort: 'niMargePct', defaultOn: false },
  { id: 'roe', label: 'ROE', sort: 'roePct', defaultOn: false },
  { id: 'roic', label: 'ROIC', sort: 'roicPct', defaultOn: true },
  { id: 'fcfMarge', label: 'FCF-Marge', sort: 'fcfMargePct', defaultOn: true },
  { id: 'conv', label: 'FCF/NI', sort: 'fcfConversionPct', defaultOn: true },
  { id: 'verw', label: 'Verw. p.a.', sort: 'aktienVerwaesserungJaehrlichPct', defaultOn: false },
  { id: 'ndEbitda', label: 'ND/EBITDA', sort: 'netDebtEbitda', defaultOn: false },
  { id: 'iroic', label: 'iROIC', sort: 'iroicPct', defaultOn: true },
  { id: 'brutto', label: 'Brutto', sort: 'bruttoMargePct', defaultOn: false },
  { id: 'reinvest', label: 'Reinvest', sort: 'reinvestitionsquotePct', defaultOn: false },
  { id: 'zins', label: 'Zinsdeckung', sort: 'interestCoverage', defaultOn: false },
  { id: 'sbcOcf', label: 'SBC/OCF', sort: 'sbcOcfPct', defaultOn: false },
  { id: 'kgv', label: 'KGV', sort: 'kgv', defaultOn: true },
  { id: 'kuv', label: 'KUV', sort: 'kuv', defaultOn: false },
  { id: 'kbv', label: 'KBV', sort: 'kbv', defaultOn: false },
  { id: 'mantra', label: 'Mantra', sort: 'mantra', defaultOn: false },
  { id: 'quality', label: 'Quality', sort: 'quality', defaultOn: true },
  { id: 'kurs', label: 'Kurs', defaultOn: false },
  { id: 'watch', label: '', defaultOn: true, immer: true },
]

const FILTER_TABS: { id: FilterTabId; label: string }[] = [
  { id: 'universum', label: 'Universum' },
  { id: 'profit', label: 'Profitabilität' },
  { id: 'wachstum', label: 'Wachstum' },
  { id: 'cash', label: 'Cash & Kapital' },
  { id: 'bilanz', label: 'Bilanz' },
  { id: 'bewertung', label: 'Bewertung' },
  { id: 'spalten', label: 'Spalten' },
]

const SORT_OPTIONEN: { id: ScreenerSort; label: string }[] = [
  { id: 'umsatzCagr5y', label: 'CAGR 5J' },
  { id: 'roicPct', label: 'ROIC' },
  { id: 'iroicPct', label: 'iROIC' },
  { id: 'fcfMargePct', label: 'FCF-Marge' },
  { id: 'fcfConversionPct', label: 'FCF/NI' },
  { id: 'quality', label: 'Quality' },
  { id: 'mantra', label: 'Mantra' },
  { id: 'kgv', label: 'KGV' },
  { id: 'marktkapMio', label: 'Marktkap' },
  { id: 'umsatzMio', label: 'Umsatz' },
  { id: 'name', label: 'Name' },
  { id: 'ticker', label: 'Ticker' },
]

function defaultSpalten(): Set<SpalteId> {
  return new Set(SPALTEN.filter((s) => s.defaultOn || s.immer).map((s) => s.id))
}

function leseSpalten(): Set<SpalteId> {
  const basis = defaultSpalten()
  if (typeof window === 'undefined') return basis
  try {
    const raw = window.localStorage.getItem(SPALTEN_KEY) ?? window.localStorage.getItem('pa-screener-spalten-v2')
    if (!raw) return basis
    const ids = JSON.parse(raw) as unknown
    if (!Array.isArray(ids)) return basis
    const out = new Set<SpalteId>()
    for (const id of ids) {
      if (typeof id === 'string' && SPALTEN.some((s) => s.id === id)) out.add(id as SpalteId)
    }
    for (const s of SPALTEN) if (s.immer) out.add(s.id)
    return out.size >= 3 ? out : basis
  } catch {
    return basis
  }
}

function speichereSpaltenLokal(next: Set<SpalteId>) {
  try {
    window.localStorage.setItem(SPALTEN_KEY, JSON.stringify([...next]))
  } catch {
    /* quota */
  }
}

function spaltenAusVorlage(ids: string[] | undefined): Set<SpalteId> | null {
  if (!ids?.length) return null
  const out = new Set<SpalteId>()
  for (const id of ids) {
    if (SPALTEN.some((s) => s.id === id)) out.add(id as SpalteId)
  }
  for (const s of SPALTEN) if (s.immer) out.add(s.id)
  return out.size >= 3 ? out : null
}

function gleichOhneSuche(a: ScreenerFilter, b: ScreenerFilter): boolean {
  return filterGleich({ ...a, suche: '' }, { ...b, suche: '' })
}

function fmtMio(v: number | null | undefined): string {
  if (v == null) return '–'
  const abs = Math.abs(v)
  if (abs >= 1000) return `${(v / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mrd`
  return `${v.toLocaleString('de-DE', { maximumFractionDigits: 0 })} Mio`
}

function fmtZahl(v: number | null | undefined, stellen = 1): string {
  if (v == null) return '–'
  return v.toLocaleString('de-DE', { maximumFractionDigits: stellen })
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '–'
  return `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
}

function pctTon(v: number | null | undefined): string {
  if (v == null) return 'text-[var(--app-text-muted)]'
  if (v > 0) return 'text-emerald-400'
  if (v < 0) return 'text-rose-400'
  return 'text-[var(--app-text)]'
}

function qcKlasse(ok: boolean | null | undefined, fallback: string): string {
  if (ok === true) return 'text-emerald-400'
  if (ok === false) return 'text-rose-400'
  if (ok === null) return 'text-amber-300/85'
  return fallback
}

function csvZelle(v: string | number | null | undefined): string {
  if (v == null) return ''
  const s = String(v)
  if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function ZahlInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null | undefined
  onChange: (n: number | null) => void
  placeholder: string
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e) => {
        const t = e.target.value.trim()
        if (t === '') onChange(null)
        else {
          const n = Number(t)
          onChange(Number.isFinite(n) ? n : null)
        }
      }}
      className={INPUT}
    />
  )
}

function SpanneFeld({
  label,
  kennzahl,
  filter,
  onFilter,
}: {
  label: string
  kennzahl: ScreenerKennzahl
  filter: ScreenerFilter
  onFilter: (f: ScreenerFilter) => void
}) {
  const sp = filter.spannen[kennzahl] ?? {}
  return (
    <label className="block text-[11px] text-[var(--app-text-muted)]">
      {label}
      <div className="mt-1 grid grid-cols-2 gap-1">
        <ZahlInput value={sp.min} placeholder="min" onChange={(min) => onFilter(setzeSpanne(filter, kennzahl, { min }))} />
        <ZahlInput value={sp.max} placeholder="max" onChange={(max) => onFilter(setzeSpanne(filter, kennzahl, { max }))} />
      </div>
    </label>
  )
}

function CheckFeld({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: ReactNode
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-[var(--app-text)]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  )
}

export function PortfolioScreenerClient() {
  const [zeilen, setZeilen] = useState<ScreenerZeile[]>([])
  const [periode, setPeriode] = useState<string | null>(null)
  const [aktualisiertAm, setAktualisiertAm] = useState<string | null>(null)
  const [schemaVersion, setSchemaVersion] = useState(1)
  const [laden, setLaden] = useState(true)
  const [erneuern, setErneuern] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [cloudWarnung, setCloudWarnung] = useState<string | null>(null)
  const [filter, setFilter] = useState<ScreenerFilter>(() => leerScreenerFilter())
  const [aktiveVorlageId, setAktiveVorlageId] = useState<string | null>(null)
  const [eigen, setEigen] = useState<ScreenerEigeneVorlage[]>([])
  const [saveName, setSaveName] = useState('')
  const [filterTab, setFilterTab] = useState<FilterTabId>('universum')
  const [filterOffen, setFilterOffen] = useState(true)
  const [spalten, setSpalten] = useState<Set<SpalteId>>(defaultSpalten)
  const [watchKeys, setWatchKeys] = useState<Set<string>>(new Set())
  const [qualityMarkierung, setQualityMarkierung] = useState(true)

  const uebernehme = useCallback((j: ApiAntwort) => {
    setZeilen(j.zeilen ?? [])
    setPeriode(j.periode ?? null)
    setAktualisiertAm(j.aktualisiertAm ?? null)
    setSchemaVersion(j.schemaVersion ?? 1)
    setCloudWarnung(j.cloudWarnung ?? (j.cloudGespeichert === false ? 'Cloud-Snapshot nicht gespeichert.' : null))
  }, [])

  const lade = useCallback(async () => {
    setLaden(true)
    setFehler(null)
    try {
      const res = await fetch('/api/portfolio-analyse/screener', { cache: 'no-store' })
      const j = (await res.json()) as ApiAntwort
      if (!res.ok || !j.ok) throw new Error(j.message ?? 'Screener konnte nicht geladen werden.')
      uebernehme(j)
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Screener konnte nicht geladen werden.')
    } finally {
      setLaden(false)
    }
  }, [uebernehme])

  useEffect(() => {
    void lade()
  }, [lade])

  useEffect(() => {
    setSpalten(leseSpalten())
  }, [])

  useEffect(() => {
    const sync = () => {
      setWatchKeys(new Set(ladeWatchlist().map((e) => e.symbolYahoo?.trim().toUpperCase()).filter(Boolean) as string[]))
    }
    sync()
    window.addEventListener(WATCHLIST_CHANGED_EVENT, sync)
    return () => window.removeEventListener(WATCHLIST_CHANGED_EVENT, sync)
  }, [])

  useEffect(() => {
    const sync = () => setEigen(leseScreenerVorlagen())
    sync()
    window.addEventListener(SCREENER_VORLAGEN_EVENT, sync)
    const onApplied = (e: Event) => {
      const key = (e as CustomEvent<{ schluessel?: string }>).detail?.schluessel
      if (key === CLIENT_STATE_KEYS.screenerVorlagen) sync()
    }
    window.addEventListener(CLIENT_STATE_APPLIED_EVENT, onApplied)
    return () => {
      window.removeEventListener(SCREENER_VORLAGEN_EVENT, sync)
      window.removeEventListener(CLIENT_STATE_APPLIED_EVENT, onApplied)
    }
  }, [])

  const baueUniversum = useCallback(async () => {
    setErneuern(true)
    setFehler(null)
    setCloudWarnung(null)
    try {
      const res = await fetch('/api/portfolio-analyse/screener', { method: 'POST' })
      const j = (await res.json()) as ApiAntwort
      if (!res.ok || !j.ok) throw new Error(j.message ?? 'Universum konnte nicht geladen werden.')
      uebernehme(j)
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Universum konnte nicht geladen werden.')
    } finally {
      setErneuern(false)
    }
  }, [uebernehme])

  const vorlageAktiv = useMemo(
    () => (aktiveVorlageId ? eigen.find((v) => v.id === aktiveVorlageId) ?? null : null),
    [aktiveVorlageId, eigen],
  )

  const angepasst = Boolean(vorlageAktiv && !gleichOhneSuche(filter, vorlageAktiv.filter))

  const gefiltert = useMemo(() => {
    const hit = zeilen.filter((z) => passtScreenerFilter(z, filter))
    return sortiereScreenerZeilen(hit, filter.sort, filter.sortAsc)
  }, [zeilen, filter])

  const sichtbar = gefiltert.slice(0, 250)
  const sichtbareSpalten = SPALTEN.filter((s) => spalten.has(s.id) || s.immer)
  const chips = useMemo(() => aktiveFilterChips(filter), [filter])
  const hatFilter = hatAktiveFilterAusserSuche(filter)

  const merke = useCallback((z: ScreenerZeile) => {
    if (findeWatchlistIdx(ladeWatchlist(), { symbol: z.ticker }) >= 0) return
    fuegeZurWatchlistHinzu({
      isin: null,
      name: z.name,
      symbolYahoo: z.ticker,
      symbolCandidates: [z.ticker],
      hinzugefuegtAm: new Date().toISOString(),
    })
  }, [])

  const wendeVorlageAn = useCallback(
    (v: ScreenerEigeneVorlage) => {
      setAktiveVorlageId(v.id)
      setFilter(kloneFilter({ ...v.filter, suche: filter.suche }))
      const ausVorlage = spaltenAusVorlage(v.spalten)
      if (ausVorlage) {
        setSpalten(ausVorlage)
        speichereSpaltenLokal(ausVorlage)
      }
      setSaveName(v.name)
    },
    [filter.suche],
  )

  const toggleSpalte = useCallback((id: SpalteId) => {
    setSpalten((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      for (const s of SPALTEN) if (s.immer) next.add(s.id)
      speichereSpaltenLokal(next)
      return next
    })
  }, [])

  const exportCsv = useCallback(() => {
    const kopf = [
      'Ticker',
      'Name',
      'Börse',
      'Jahre',
      'Umsatz Mio',
      'CAGR 5J',
      'ROIC',
      'iROIC',
      'Brutto',
      'FCF-Marge',
      'FCF/NI',
      'Reinvest',
      'ND/EBITDA',
      'Zins',
      'SBC/OCF',
      'KGV',
      'Quality',
    ]
    const zeilenCsv = gefiltert.map((z) => {
      const qc = qualityCompounderScore(z)
      return [
        z.ticker,
        z.name,
        z.boerse,
        z.jahreAnzahl,
        z.umsatzMio,
        z.umsatzCagr5y,
        z.roicPct,
        z.iroicPct,
        z.bruttoMargePct,
        z.fcfMargePct,
        z.fcfConversionPct,
        z.reinvestitionsquotePct,
        z.netDebtEbitda,
        z.interestCoverage,
        z.sbcOcfPct,
        z.kgv,
        `${qc.ok}/${qc.n}`,
      ]
        .map(csvZelle)
        .join(';')
    })
    const blob = new Blob([[kopf.join(';'), ...zeilenCsv].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `screener-${periode ?? 'export'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [gefiltert, periode])

  const speichernNeu = useCallback(() => {
    const name = saveName.trim() || vorlageAktiv?.name || 'Meine Vorlage'
    const liste = speichereScreenerVorlage({
      name,
      filter: kloneFilter(filter),
      spalten: [...spalten],
    })
    setEigen(liste)
    const neu = liste[0]
    if (neu) {
      setAktiveVorlageId(neu.id)
      setSaveName(neu.name)
    }
  }, [filter, saveName, spalten, vorlageAktiv?.name])

  const ueberschreiben = useCallback(() => {
    if (!aktiveVorlageId) return
    const name = saveName.trim() || eigen.find((v) => v.id === aktiveVorlageId)?.name || 'Meine Vorlage'
    setEigen(
      speichereScreenerVorlage({
        name,
        filter: kloneFilter(filter),
        spalten: [...spalten],
        id: aktiveVorlageId,
      }),
    )
    setSaveName(name)
  }, [aktiveVorlageId, eigen, filter, saveName, spalten])

  const umbenennen = useCallback(() => {
    if (!aktiveVorlageId || !saveName.trim()) return
    setEigen(benenneScreenerVorlageUm(aktiveVorlageId, saveName.trim()))
  }, [aktiveVorlageId, saveName])

  const zuruecksetzen = useCallback(() => {
    setFilter(leerScreenerFilter())
    setAktiveVorlageId(null)
    setSaveName('')
  }, [])

  const stand = aktualisiertAm
    ? new Date(aktualisiertAm).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
    : null
  const schemaAlt = zeilen.length > 0 && schemaVersion < SCREENER_SCHEMA_VERSION
  const qcSpalteAn = spalten.has('quality')

  return (
    <PortfolioAnalyseShell
      title="Aktienscreener"
      description="US-gelistete SEC-Filer filtern — eigene Vorlagen, volle Kontrolle über Schwellen und Spalten."
    >
      <PaCard className="space-y-3 p-4 sm:p-5">
        {/* 1 Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--app-text-muted)]">
            {zeilen.length > 0
              ? `${zeilen.length.toLocaleString('de-DE')} Titel · ${periode ?? '–'} · ${gefiltert.length.toLocaleString('de-DE')} Treffer`
              : 'Noch kein Universum im Cache.'}
            {stand ? ` · Stand ${stand}` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportCsv} disabled={gefiltert.length === 0} className={BTN}>
              CSV
            </button>
            <button type="button" onClick={() => void baueUniversum()} disabled={erneuern} className={BTN_WARN}>
              {erneuern ? 'Lade SEC-Universum …' : zeilen.length > 0 ? 'Universum neu aufbauen' : 'Universum laden'}
            </button>
          </div>
        </div>

        {cloudWarnung ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">{cloudWarnung}</p>
        ) : null}
        {schemaAlt ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Universum ohne neuere Kennzahlen (iROIC, Brutto, Zins, SBC/OCF). Einmal „Universum neu aufbauen“.
          </p>
        ) : null}

        {/* 2 Eigene Vorlagen */}
        <section className="space-y-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)]/25 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--app-text-muted)]">Meine Vorlagen</p>
            <button type="button" onClick={zuruecksetzen} className="text-[11px] text-[var(--app-text-muted)] hover:text-teal-200">
              Filter zurücksetzen
            </button>
          </div>
          {eigen.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {eigen.map((v) => {
                const an = aktiveVorlageId === v.id
                return (
                  <span key={v.id} className="inline-flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => wendeVorlageAn(v)}
                      className={`${CHIP} ${an ? (angepasst ? CHIP_TWEAK : CHIP_AN) : CHIP_AUS}`}
                    >
                      {v.name}
                      {an && angepasst ? ' · angepasst' : ''}
                    </button>
                    <button
                      type="button"
                      aria-label={`${v.name} löschen`}
                      onClick={() => {
                        setEigen(loescheScreenerVorlage(v.id))
                        if (aktiveVorlageId === v.id) {
                          setAktiveVorlageId(null)
                          setSaveName('')
                        }
                      }}
                      className="px-1 text-[11px] text-[var(--app-text-muted)] hover:text-rose-300"
                    >
                      ×
                    </button>
                  </span>
                )
              })}
            </div>
          ) : (
            <p className="text-[11px] text-[var(--app-text-muted)]">
              Noch keine Vorlage — Filter setzen, Namen vergeben und speichern.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Name der Vorlage"
              className={`${INPUT} max-w-xs`}
            />
            <button type="button" onClick={speichernNeu} className={BTN_PRIM}>
              Neu speichern
            </button>
            {vorlageAktiv ? (
              <>
                <button type="button" onClick={ueberschreiben} className={BTN}>
                  Überschreiben
                </button>
                <button type="button" onClick={umbenennen} disabled={!saveName.trim()} className={BTN}>
                  Umbenennen
                </button>
              </>
            ) : null}
          </div>
        </section>

        {/* 3 Aktive Filter-Chips */}
        {chips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-[var(--app-text-muted)]">Aktiv:</span>
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setFilter(c.entferne(filter))}
                className="rounded-md border border-teal-500/35 bg-teal-500/10 px-2 py-0.5 text-[11px] text-teal-100 hover:border-rose-400/50 hover:bg-rose-500/10"
                title="Entfernen"
              >
                {c.label} ×
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFilter({ ...leerScreenerFilter(), suche: filter.suche, sort: filter.sort, sortAsc: filter.sortAsc })}
              className="text-[11px] text-[var(--app-text-muted)] underline hover:text-rose-200"
            >
              alle löschen
            </button>
          </div>
        ) : null}

        {/* 4 Filter-Toolbar */}
        <section className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={filter.suche}
              onChange={(e) => setFilter({ ...filter, suche: e.target.value })}
              placeholder="Suche: Ticker, Name, Sektor …"
              className={`${INPUT} max-w-sm`}
            />
            <label className="flex items-center gap-1.5 text-[11px] text-[var(--app-text-muted)]">
              Sort
              <select
                value={filter.sort}
                onChange={(e) => {
                  const sort = e.target.value as ScreenerSort
                  setFilter({
                    ...filter,
                    sort,
                    sortAsc: sortierungIstAufsteigendDefault(sort),
                  })
                }}
                className={`${INPUT} w-auto min-w-[7rem]`}
              >
                {SORT_OPTIONEN.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setFilter({ ...filter, sortAsc: !filter.sortAsc })}
              className={BTN}
              title="Sortierrichtung"
            >
              {filter.sortAsc ? '↑ aufsteigend' : '↓ absteigend'}
            </button>
            <CheckFeld checked={qualityMarkierung} onChange={setQualityMarkierung}>
              Quality-Markierung
            </CheckFeld>
            <button type="button" onClick={() => setFilterOffen((v) => !v)} className={BTN}>
              {filterOffen ? 'Filter einklappen' : 'Filter ausklappen'}
              {hatFilter ? ` · ${chips.length}` : ''}
            </button>
          </div>

          {filterOffen ? (
            <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)]/30 px-3 py-2.5">
              <div className="mb-3 flex flex-wrap gap-1">
                {FILTER_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setFilterTab(t.id)}
                    className={`${CHIP} ${filterTab === t.id ? CHIP_AN : CHIP_AUS}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {filterTab === 'universum' ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="block text-[11px] text-[var(--app-text-muted)]">
                    Börse
                    <select
                      value={filter.boerse}
                      onChange={(e) => setFilter({ ...filter, boerse: e.target.value as ScreenerFilter['boerse'] })}
                      className={`mt-1 ${INPUT}`}
                    >
                      <option value="alle">Nasdaq + NYSE + CBOE</option>
                      <option value="Nasdaq">Nasdaq</option>
                      <option value="NYSE">NYSE</option>
                      <option value="CBOE">CBOE</option>
                    </select>
                  </label>
                  <SpanneFeld label="Historie (Jahre)" kennzahl="jahreAnzahl" filter={filter} onFilter={setFilter} />
                  <SpanneFeld label="Umsatz (Mio $)" kennzahl="umsatzMio" filter={filter} onFilter={setFilter} />
                  <SpanneFeld label="Marktkap (Mio $)" kennzahl="marktkapMio" filter={filter} onFilter={setFilter} />
                  <CheckFeld checked={filter.lueckenErlaubt} onChange={(v) => setFilter({ ...filter, lueckenErlaubt: v })}>
                    unvollständige Zeilen behalten
                  </CheckFeld>
                </div>
              ) : null}

              {filterTab === 'profit' ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <SpanneFeld label="ROE %" kennzahl="roePct" filter={filter} onFilter={setFilter} />
                  <SpanneFeld label="ROIC %" kennzahl="roicPct" filter={filter} onFilter={setFilter} />
                  <SpanneFeld label="iROIC 3–5J %" kennzahl="iroicPct" filter={filter} onFilter={setFilter} />
                  <SpanneFeld label="ROIC 5J-Schnitt %" kennzahl="roic5yAvgPct" filter={filter} onFilter={setFilter} />
                  <SpanneFeld label="iROIC − WACC Pp." kennzahl="incrementalValueSpreadPct" filter={filter} onFilter={setFilter} />
                  <SpanneFeld label="Bruttomarge %" kennzahl="bruttoMargePct" filter={filter} onFilter={setFilter} />
                  <SpanneFeld label="EBIT-Marge %" kennzahl="ebitMargePct" filter={filter} onFilter={setFilter} />
                  <SpanneFeld label="NI-Marge %" kennzahl="niMargePct" filter={filter} onFilter={setFilter} />
                  <SpanneFeld label="FCF-Marge %" kennzahl="fcfMargePct" filter={filter} onFilter={setFilter} />
                  <CheckFeld checked={filter.nurGewinn} onChange={(v) => setFilter({ ...filter, nurGewinn: v })}>
                    nur Gewinn
                  </CheckFeld>
                  <CheckFeld checked={filter.fcfPositiv} onChange={(v) => setFilter({ ...filter, fcfPositiv: v })}>
                    FCF &gt; 0
                  </CheckFeld>
                </div>
              ) : null}

              {filterTab === 'wachstum' ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <SpanneFeld label="Umsatz 1J %" kennzahl="umsatzWachstumPct" filter={filter} onFilter={setFilter} />
                  <SpanneFeld label="CAGR 3J %" kennzahl="umsatzCagr3y" filter={filter} onFilter={setFilter} />
                  <SpanneFeld label="CAGR 5J %" kennzahl="umsatzCagr5y" filter={filter} onFilter={setFilter} />
                  <SpanneFeld label="CAGR 10J %" kennzahl="umsatzCagr10y" filter={filter} onFilter={setFilter} />
                  <SpanneFeld label="EPS-CAGR 5J %" kennzahl="epsCagr5y" filter={filter} onFilter={setFilter} />
                  <SpanneFeld label="FCF-CAGR 5J %" kennzahl="fcfCagr5y" filter={filter} onFilter={setFilter} />
                  <SpanneFeld label="FCF/Aktie-CAGR 5J %" kennzahl="fcfJeAktieCagr5y" filter={filter} onFilter={setFilter} />
                  <SpanneFeld label="Rule of 40" kennzahl="ruleOf40" filter={filter} onFilter={setFilter} />
                </div>
              ) : null}

              {filterTab === 'cash' ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <SpanneFeld label="FCF-Conversion %" kennzahl="fcfConversionPct" filter={filter} onFilter={setFilter} />
                  <SpanneFeld label="Reinvestitionsquote %" kennzahl="reinvestitionsquotePct" filter={filter} onFilter={setFilter} />
                  <SpanneFeld label="CapEx/Umsatz %" kennzahl="capexSalesPct" filter={filter} onFilter={setFilter} />
                  <SpanneFeld label="SBC / OCF %" kennzahl="sbcOcfPct" filter={filter} onFilter={setFilter} />
                  <SpanneFeld label="Verwässerung p.a. %" kennzahl="aktienVerwaesserungJaehrlichPct" filter={filter} onFilter={setFilter} />
                  <CheckFeld checked={filter.aktienSinkend} onChange={(v) => setFilter({ ...filter, aktienSinkend: v })}>
                    nur sinkende Aktienzahl
                  </CheckFeld>
                  <div className="sm:col-span-2 space-y-2 rounded-md border border-[var(--app-border)]/60 px-2 py-2">
                    <CheckFeld
                      checked={filter.conversionOderRo40 != null}
                      onChange={(an) =>
                        setFilter({
                          ...filter,
                          conversionOderRo40: an ? { conversionMin: 75, ruleOf40Min: 40 } : null,
                        })
                      }
                    >
                      ODER: Conversion ≥ x % oder Rule of 40 ≥ y
                    </CheckFeld>
                    {filter.conversionOderRo40 ? (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-[11px] text-[var(--app-text-muted)]">
                          Conversion min %
                          <ZahlInput
                            value={filter.conversionOderRo40.conversionMin}
                            placeholder="75"
                            onChange={(n) =>
                              setFilter({
                                ...filter,
                                conversionOderRo40:
                                  n == null
                                    ? null
                                    : {
                                        conversionMin: n,
                                        ruleOf40Min: filter.conversionOderRo40?.ruleOf40Min ?? 40,
                                      },
                              })
                            }
                          />
                        </label>
                        <label className="block text-[11px] text-[var(--app-text-muted)]">
                          Rule of 40 min
                          <ZahlInput
                            value={filter.conversionOderRo40.ruleOf40Min}
                            placeholder="40"
                            onChange={(n) =>
                              setFilter({
                                ...filter,
                                conversionOderRo40:
                                  n == null
                                    ? null
                                    : {
                                        conversionMin: filter.conversionOderRo40?.conversionMin ?? 75,
                                        ruleOf40Min: n,
                                      },
                              })
                            }
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {filterTab === 'bilanz' ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <SpanneFeld label="Net Debt/EBITDA" kennzahl="netDebtEbitda" filter={filter} onFilter={setFilter} />
                  <SpanneFeld label="Zinsdeckung ×" kennzahl="interestCoverage" filter={filter} onFilter={setFilter} />
                  <CheckFeld checked={filter.ekPositiv} onChange={(v) => setFilter({ ...filter, ekPositiv: v })}>
                    Eigenkapital &gt; 0
                  </CheckFeld>
                </div>
              ) : null}

              {filterTab === 'bewertung' ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <SpanneFeld label="KGV" kennzahl="kgv" filter={filter} onFilter={setFilter} />
                  <SpanneFeld label="KUV" kennzahl="kuv" filter={filter} onFilter={setFilter} />
                  <SpanneFeld label="KBV" kennzahl="kbv" filter={filter} onFilter={setFilter} />
                </div>
              ) : null}

              {filterTab === 'spalten' ? (
                <div className="flex flex-wrap gap-x-3 gap-y-2">
                  {SPALTEN.filter((s) => !s.immer).map((s) => (
                    <label key={s.id} className="inline-flex items-center gap-1.5 text-xs text-[var(--app-text)]">
                      <input type="checkbox" checked={spalten.has(s.id)} onChange={() => toggleSpalte(s.id)} />
                      {s.label}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        {fehler ? <p className="text-sm text-rose-300">{fehler}</p> : null}
        {laden ? <p className="text-sm text-[var(--app-text-muted)]">Lade Snapshot …</p> : null}

        {/* 5 Tabelle */}
        <div className={`${PA_TABLE_FRAME} ${PA_SCROLL_ELEGANT}`}>
          <div className={appTableScrollClassName}>
            <table className={PA_TABLE_COMPACT}>
              <thead>
                <tr>
                  {sichtbareSpalten.map((s) => (
                    <th
                      key={s.id}
                      className={s.id === 'ticker' || s.id === 'name' || s.id === 'quality' ? '' : 'text-right'}
                    >
                      {s.sort ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (filter.sort === s.sort) setFilter({ ...filter, sortAsc: !filter.sortAsc })
                            else {
                              setFilter({
                                ...filter,
                                sort: s.sort!,
                                sortAsc: sortierungIstAufsteigendDefault(s.sort!),
                              })
                            }
                          }}
                          className="hover:text-teal-200"
                        >
                          {s.label || '·'}
                          {filter.sort === s.sort ? (filter.sortAsc ? ' ↑' : ' ↓') : ''}
                        </button>
                      ) : (
                        s.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sichtbar.map((z) => {
                  const mantra = zaehleMantraTreffer(z)
                  const qcListe = bewerteQualityCompounder(z)
                  const qcScore = qualityCompounderScore(z)
                  const qcFehl = qualityVerfehlungen(z)
                  const qc = Object.fromEntries(qcListe.map((e) => [e.id, e])) as Record<
                    string,
                    (typeof qcListe)[number]
                  >
                  const mark = qualityMarkierung && qcSpalteAn
                  const zellen: Record<SpalteId, ReactNode> = {
                    ticker: (
                      <Link
                        href={fundamentaldatenHref({ symbol: z.ticker })}
                        className="font-semibold text-teal-300 hover:underline"
                      >
                        {z.ticker}
                      </Link>
                    ),
                    name: (
                      <span className="block max-w-[14rem] truncate text-[var(--app-text)]" title={z.name}>
                        {z.name}
                      </span>
                    ),
                    boerse: <span className="text-[var(--app-text-muted)]">{z.boerse}</span>,
                    jahre: (
                      <span className="text-[var(--app-text-muted)]">
                        {z.jahreAnzahl}
                        {z.vonJahr && z.bisJahr ? (
                          <span className="ml-1 text-[10px]">
                            {z.vonJahr}–{z.bisJahr}
                          </span>
                        ) : null}
                      </span>
                    ),
                    umsatz: fmtMio(z.umsatzMio),
                    cagr5: (
                      <span className={mark ? qcKlasse(qc.umsatzCagr?.ok, pctTon(z.umsatzCagr5y)) : pctTon(z.umsatzCagr5y)}>
                        {fmtPct(z.umsatzCagr5y)}
                      </span>
                    ),
                    wachstum: <span className={pctTon(z.umsatzWachstumPct)}>{fmtPct(z.umsatzWachstumPct)}</span>,
                    niMarge: <span className={pctTon(z.niMargePct)}>{fmtPct(z.niMargePct)}</span>,
                    roe: <span className={pctTon(z.roePct)}>{fmtPct(z.roePct)}</span>,
                    roic: (
                      <span className={mark ? qcKlasse(qc.roic5y?.ok, pctTon(z.roicPct)) : pctTon(z.roicPct)}>
                        {fmtPct(z.roicPct)}
                      </span>
                    ),
                    fcfMarge: <span className={pctTon(z.fcfMargePct)}>{fmtPct(z.fcfMargePct)}</span>,
                    conv: (
                      <span className={mark ? qcKlasse(qc.conv?.ok, '') : undefined}>{fmtPct(z.fcfConversionPct)}</span>
                    ),
                    verw: (
                      <span
                        className={pctTon(
                          z.aktienVerwaesserungJaehrlichPct != null ? -z.aktienVerwaesserungJaehrlichPct : null,
                        )}
                      >
                        {fmtPct(z.aktienVerwaesserungJaehrlichPct)}
                      </span>
                    ),
                    ndEbitda: (
                      <span className={mark ? qcKlasse(qc.ndEbitda?.ok, '') : undefined}>
                        {fmtZahl(z.netDebtEbitda, 2)}
                      </span>
                    ),
                    iroic: (
                      <span className={mark ? qcKlasse(qc.iroic?.ok, pctTon(z.iroicPct)) : pctTon(z.iroicPct)}>
                        {fmtPct(z.iroicPct)}
                      </span>
                    ),
                    brutto: (
                      <span className={mark ? qcKlasse(qc.brutto?.ok, '') : undefined}>{fmtPct(z.bruttoMargePct)}</span>
                    ),
                    reinvest: (
                      <span className={mark ? qcKlasse(qc.reinvest?.ok, '') : undefined}>
                        {fmtPct(z.reinvestitionsquotePct)}
                      </span>
                    ),
                    zins: (
                      <span className={mark ? qcKlasse(qc.zins?.ok, '') : undefined}>
                        {z.interestCoverage != null ? fmtZahl(z.interestCoverage, 1) : '–'}
                      </span>
                    ),
                    sbcOcf: (
                      <span className={mark ? qcKlasse(qc.sbc?.ok, '') : undefined}>{fmtPct(z.sbcOcfPct)}</span>
                    ),
                    kgv: fmtZahl(z.kgv),
                    kuv: fmtZahl(z.kuv),
                    kbv: fmtZahl(z.kbv),
                    mantra: (
                      <span title="ROIC, Conversion/Ro40, ND/EBITDA, Verwässerung, FCF-Marge">{mantra}/5</span>
                    ),
                    quality: (
                      <span
                        className={`block max-w-[14rem] text-left ${qcScore.fehl > 0 ? 'text-rose-300' : qcScore.luecke > 0 ? 'text-amber-200' : 'text-emerald-400'}`}
                        title={qcListe
                          .map(
                            (e) =>
                              `${e.kurz}: ${e.text} (${e.soll})${e.ok === true ? ' ✓' : e.ok === false ? ' ✗' : ' ?'}`,
                          )
                          .join('\n')}
                      >
                        {qcScore.ok}/{qcScore.n}
                        {qcFehl.length > 0 ? (
                          <span className="mt-0.5 block text-[10px] font-normal leading-snug text-rose-300/90">
                            {qcFehl.map((e) => `${e.kurz} ${e.text}`).join(' · ')}
                          </span>
                        ) : null}
                      </span>
                    ),
                    kurs: fmtZahl(z.kurs, 2),
                    watch: (
                      <button
                        type="button"
                        disabled={watchKeys.has(z.ticker)}
                        onClick={() => merke(z)}
                        className="text-[11px] text-amber-200/90 hover:underline disabled:text-[var(--app-text-muted)]"
                      >
                        {watchKeys.has(z.ticker) ? 'gemerkt' : 'Watchlist'}
                      </button>
                    ),
                  }
                  return (
                    <tr key={`${z.cik}-${z.ticker}`}>
                      {sichtbareSpalten.map((s) => (
                        <td
                          key={s.id}
                          className={
                            s.id === 'ticker' || s.id === 'name' || s.id === 'boerse' || s.id === 'quality'
                              ? ''
                              : 'text-right tabular-nums'
                          }
                        >
                          {zellen[s.id]}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        {gefiltert.length > sichtbar.length ? (
          <p className="text-xs text-[var(--app-text-muted)]">
            Zeige 250 von {gefiltert.length.toLocaleString('de-DE')} Treffern — Filter enger setzen.
          </p>
        ) : null}
        <p className="text-xs leading-relaxed text-[var(--app-text-muted)]">
          GuV/Bilanz: SEC EDGAR Frames. Kurs/Multiples: Yahoo. Quality zählt 11 Compounder-Punkte ohne auszufiltern.
        </p>
      </PaCard>
    </PortfolioAnalyseShell>
  )
}
